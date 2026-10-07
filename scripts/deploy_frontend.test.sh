#!/usr/bin/env bash
# Plain bash test for scripts/deploy_frontend.sh (the zero-downtime frontend deploy), run by
# Frontend CI and by hand with:
#   bash scripts/deploy_frontend.test.sh
#
# A fake `docker` (python3, prepended onto PATH) keeps the containers in a JSON file: `compose
# create` creates the standby stopped, `start`/`up` run a container on the image just built,
# `stop`/`rm` stop and remove it, and `exec <c> wget` answers from that container's plan (ok/fail,
# the last one repeating). `exec <c> tar` and `run` stand for the asset copy into the volume.
# `sleep` is a no-op. Every docker call is logged, one per line, for the order checks.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$HERE/deploy_frontend.sh"
FAILED=0

fail() { echo "FAIL: $1"; FAILED=1; }
pass() { echo "ok - $1"; }

make_host() {
  local dir="$1"
  mkdir -p "$dir/bin"
  cat > "$dir/bin/docker" <<'PY'
#!/usr/bin/env python3
import json, os, sys

args = sys.argv[1:]
with open(os.environ["FAKE_LOG"], "a") as f:
    f.write(" ".join(a if len(a) < 60 else "<script>" for a in args) + "\n")
path = os.environ["FAKE_STATE"]
state = json.load(open(path))
boxes, plans = state["containers"], state["plans"]
NEW = "sha256:new"
NAMES = {"lms-frontend": "lms-frontend", "lms-frontend-standby": "lms-frontend-standby"}

def save():
    json.dump(state, open(path, "w"))

if args[0] == "compose":
    rest = [a for a in args[1:] if a not in ("--profile", "standby")]
    verb, name = rest[0], NAMES.get(rest[-1])
    if verb == "config":
        sys.exit(0)
    if verb == "create":
        boxes[name] = {"running": False, "image": NEW}
    elif verb == "start":
        boxes[name]["running"] = True
        boxes[name]["restarts"] = state.get("standby_restarts", 0)
    elif verb == "up":
        boxes[name] = {"running": True, "image": state.get("up_image", NEW)}
    elif verb == "stop":
        if name in boxes:
            boxes[name]["running"] = False
    elif verb == "rm":
        boxes.pop(name, None)
    save()
    sys.exit(0)
if args[0] == "image":
    if "-f" in args:
        print(NEW)
    sys.exit(0)
if args[0] == "inspect":
    if args[1] == "-f":
        box = boxes.get(args[3])
        if box is None:
            sys.exit(1)
        print({"{{.State.Running}}": "true" if box["running"] else "false", "{{.Image}}": box["image"],
               "{{.RestartCount}}": str(box.get("restarts", 0))}[args[2]])
        sys.exit(0)
    sys.exit(0 if args[1] in boxes else 1)
if args[0] == "exec":
    box = boxes.get(args[1])
    if box is None or not box["running"]:
        sys.exit(1)
    if args[2] == "tar":
        print("TAR-STREAM")
        sys.exit(0)
    plan = plans.get(args[1])
    step = (plan.pop(0) if len(plan) > 1 else plan[0]) if plan else "ok"
    save()
    sys.exit(0 if step == "ok" else 1)
if args[0] == "run":
    if any("wget" in a for a in args):  # the off-network smoke test
        sys.exit(1 if os.environ.get("FAKE_SMOKE_FAIL") else 0)
    sys.stdin.read()
    sys.exit(1 if os.environ.get("FAKE_RUN_FAIL") else 0)
if args[0] == "logs":
    sys.exit(0)
sys.exit("fake docker: unexpected " + " ".join(args))
PY
  printf '#!/bin/sh\nexit 0\n' > "$dir/bin/sleep"
  chmod +x "$dir/bin/docker" "$dir/bin/sleep"
}

# run NAME STATE_JSON [ENV=VALUE...]: runs the script; sets OUT, RC, CALLS (one docker call per line)
# and FINAL (the containers JSON afterwards).
run() {
  local dir
  dir="$(mktemp -d)"
  make_host "$dir"
  printf '%s' "$2" > "$dir/state.json"
  shift 2
  OUT="$(env PATH="$dir/bin:$PATH" FAKE_STATE="$dir/state.json" FAKE_LOG="$dir/docker.log" \
    DEPLOY_HEALTH_TIMEOUT=2 DEPLOY_SETTLE_SECONDS=0 "$@" bash "$SCRIPT" 2>&1)"
  RC=$?
  CALLS="$(cat "$dir/docker.log" 2>/dev/null)"
  FINAL="$(python3 -c 'import json,sys; print(json.dumps(json.load(open(sys.argv[1]))["containers"], sort_keys=True))' "$dir/state.json")"
  rm -rf "$dir"
}

compose_calls() { grep '^compose' <<<"$CALLS" | grep -v '^compose config'; }

line_no() { grep -n -x -F -- "$1" <<<"$CALLS" | head -1 | cut -d: -f1; }

OLD='{"running": true, "image": "sha256:old"}'
TODAY="{\"containers\": {\"lms-frontend\": $OLD}, \"plans\": {}}"

# 1 -- the new build serves from the standby before the old container is replaced
run happy "{\"containers\": {\"lms-frontend\": $OLD}, \"plans\": {\"lms-frontend-standby\": [\"fail\", \"ok\"]}}"
expected="compose --profile standby create --no-build --force-recreate lms-frontend-standby
compose --profile standby start lms-frontend-standby
compose up -d --no-build --no-deps lms-frontend
compose --profile standby stop lms-frontend-standby
compose --profile standby rm -f lms-frontend-standby"
[ "$RC" -eq 0 ] && pass "happy path exits 0" || fail "happy path exit $RC: $OUT"
[ "$(compose_calls)" = "$expected" ] && pass "standby first, then the primary, then the standby leaves" \
  || fail "compose order was: $(compose_calls)"
tar_line="$(line_no "exec lms-frontend tar -C /usr/share/nginx/html -cf - assets")"
start_line="$(line_no "compose --profile standby start lms-frontend-standby")"
[ -n "$tar_line" ] && [ "$tar_line" -lt "$start_line" ] && pass "the running build's assets are kept before the standby serves" \
  || fail "asset copy ($tar_line) must precede the standby start ($start_line)"
grep -q '^run --rm -i --network none -v lms-frontend-old-assets:/srv/old-assets --entrypoint sh lms-frontend:latest -c' <<<"$CALLS" \
  && pass "assets go into the lms-frontend-old-assets volume" || fail "no copy into the volume: $CALLS"
[ "$FINAL" = '{"lms-frontend": {"image": "sha256:new", "running": true}}' ] && pass "only the new lms-frontend is left" \
  || fail "final containers: $FINAL"

# 2 -- a standby that never serves is removed and the old container is never touched
run never "{\"containers\": {\"lms-frontend\": $OLD}, \"plans\": {\"lms-frontend-standby\": [\"fail\"]}}"
[ "$RC" -eq 1 ] && pass "a build that never serves fails the deploy" || fail "exit $RC"
grep -q "previous build) kept serving" <<<"$OUT" && pass "it says the previous build kept serving" || fail "message: $OUT"
! grep -q '^compose up -d --no-build --no-deps lms-frontend$' <<<"$CALLS" && pass "lms-frontend is never replaced" \
  || fail "lms-frontend was replaced"
[ "$(compose_calls | tail -2)" = "compose --profile standby stop lms-frontend-standby
compose --profile standby rm -f lms-frontend-standby" ] && pass "the standby is stopped, then removed" || fail "$(compose_calls)"
[ "$FINAL" = "{\"lms-frontend\": {\"image\": \"sha256:old\", \"running\": true}}" ] && pass "the old container still serves" \
  || fail "final containers: $FINAL"

# 2a -- an image that does not serve / off the network is refused before anything starts
run bad_image "$TODAY" FAKE_SMOKE_FAIL=1
[ "$RC" -eq 1 ] && [ -z "$(compose_calls)" ] && ! grep -q '^exec' <<<"$CALLS" \
  && pass "an image that does not serve stops the deploy before any container changes" || fail "exit $RC, calls $CALLS"

# 2b -- a standby whose nginx keeps exiting (restart loop) is given up at once
run crash_loop "{\"containers\": {\"lms-frontend\": $OLD}, \"standby_restarts\": 1, \"plans\": {\"lms-frontend-standby\": [\"fail\"]}}"
[ "$RC" -eq 1 ] && [ "$(grep -c '^exec lms-frontend-standby wget' <<<"$CALLS")" -eq 0 ] \
  && pass "a restarting standby fails at once" || fail "exit $RC, calls $CALLS"

# 3 -- a primary that fails after the switch leaves the standby serving
run primary_fails "{\"containers\": {\"lms-frontend\": $OLD}, \"plans\": {\"lms-frontend\": [\"ok\", \"fail\"]}}"
[ "$RC" -eq 1 ] && pass "a primary that never serves fails the deploy" || fail "exit $RC"
grep -q "is serving alone" <<<"$OUT" && pass "it says the standby is serving alone" || fail "message: $OUT"
! grep -q 'stop lms-frontend-standby\|rm -f lms-frontend-standby' <<<"$CALLS" && pass "the standby is kept" \
  || fail "the standby was removed: $CALLS"

# 4 -- a standby left serving by a failed deploy covers the next one
run leftover "{\"containers\": {\"lms-frontend\": {\"running\": false, \"image\": \"sha256:old\"}, \"lms-frontend-standby\": {\"running\": true, \"image\": \"sha256:mid\"}}, \"plans\": {}}"
[ "$RC" -eq 0 ] && pass "a leftover standby covers the deploy" || fail "exit $RC: $OUT"
! grep -q 'create\|start lms-frontend-standby' <<<"$CALLS" && pass "the serving standby is not recreated" || fail "$CALLS"
grep -q '^exec lms-frontend-standby tar' <<<"$CALLS" && pass "its build's assets are kept" || fail "$CALLS"
[ "$FINAL" = '{"lms-frontend": {"image": "sha256:new", "running": true}}' ] && pass "the standby is gone afterwards" \
  || fail "final containers: $FINAL"

# 5 -- nothing serving: replace lms-frontend directly
run nothing '{"containers": {}, "plans": {}}'
[ "$RC" -eq 0 ] && [ "$(compose_calls)" = "compose up -d --no-build --no-deps lms-frontend" ] \
  && pass "with nothing serving the primary is replaced directly" || fail "exit $RC, calls $(compose_calls)"

# 6 -- failing to keep the assets costs old tabs a reload, never the deploy
run keep_fails "$TODAY" FAKE_RUN_FAIL=1
[ "$RC" -eq 0 ] && grep -q "assets were not kept" <<<"$OUT" && pass "a failed asset copy warns and the deploy goes on" \
  || fail "exit $RC: $OUT"

if [ "$FAILED" -ne 0 ]; then
  echo "deploy_frontend.test.sh: FAILED"
  exit 1
fi
echo "deploy_frontend.test.sh: all passed"
