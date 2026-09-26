#!/usr/bin/env bash
# Plain bash test for scripts/sentry-release.sh (chosen over a vitest test that spawns bash:
# vitest.config.js only collects `src/**/*.test.ts`, and this task is scoped to touching only
# the workflow, the script, and its test — widening that glob is a separate change). Run with:
#   bash scripts/sentry-release.test.sh
#
# Stubs `curl` (prepended onto PATH) so no network call ever happens. The stub logs every arg it
# was called with, one per line, terminated by a "---END-ARGS---" marker, then "responds" with
# the next status code queued in $STUB_CODES_FILE (default 200 if the queue is empty) — exactly
# what `-w '%{http_code}'` would print, since the script discards the body with `-o /dev/null`.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$HERE/sentry-release.sh"
FAILED=0

fail() {
  echo "FAIL: $1"
  FAILED=1
}

pass() {
  echo "ok - $1"
}

# --- stub curl -------------------------------------------------------------------------------

make_stub_bin() {
  local bin_dir="$1"
  mkdir -p "$bin_dir"
  cat > "$bin_dir/curl" <<'STUB'
#!/usr/bin/env bash
for a in "$@"; do printf '%s\n' "$a"; done >> "$CURL_LOG"
printf '%s\n' "---END-ARGS---" >> "$CURL_LOG"
code=200
if [ -s "$STUB_CODES_FILE" ]; then
  code="$(head -n1 "$STUB_CODES_FILE")"
  tail -n +2 "$STUB_CODES_FILE" > "$STUB_CODES_FILE.next"
  mv "$STUB_CODES_FILE.next" "$STUB_CODES_FILE"
fi
printf '%s' "$code"
exit 0
STUB
  chmod +x "$bin_dir/curl"
}

# Runs sentry-release.sh with a fresh stub curl and the given queued HTTP status codes (one per
# line). Sets globals: RUN_EXIT, RUN_OUT, CURL_LOG (path), and CALLS (array of call blocks, each
# a newline-joined string of that invocation's args).
run_script() {
  local codes="$1"; shift
  local work; work="$(mktemp -d)"
  local bin_dir="$work/bin"
  make_stub_bin "$bin_dir"
  CURL_LOG="$work/curl.log"
  : > "$CURL_LOG"
  local codes_file="$work/codes"
  printf '%s' "$codes" > "$codes_file"

  # `env` (not shell prefix-assignment) because "$@" holds VAR=value strings that came from a
  # parameter expansion — bash only recognizes prefix-assignment syntax in literal source words,
  # not in the result of expanding "$@", so it would otherwise try to run them as commands.
  RUN_OUT="$(env PATH="$bin_dir:$PATH" CURL_LOG="$CURL_LOG" STUB_CODES_FILE="$codes_file" "$@" bash "$SCRIPT" 2>&1)"
  RUN_EXIT=$?

  CALLS=()
  if [ -s "$CURL_LOG" ]; then
    local block=""
    while IFS= read -r line; do
      if [ "$line" = "---END-ARGS---" ]; then
        CALLS+=("$block")
        block=""
      else
        block="${block}${line}"$'\n'
      fi
    done < "$CURL_LOG"
  fi
  rm -rf "$work"
}

call_has() {
  # call_has <call-index (0-based)> <exact-arg-text>
  local idx="$1" needle="$2"
  [ "${#CALLS[@]}" -gt "$idx" ] || return 1
  printf '%s' "${CALLS[$idx]}" | grep -qxF -- "$needle"
}

call_arg_count_containing() {
  # Number of args in a call that contain $2 as a substring.
  local idx="$1" needle="$2"
  [ "${#CALLS[@]}" -gt "$idx" ] || { echo 0; return; }
  printf '%s' "${CALLS[$idx]}" | grep -cF -- "$needle"
}

TOKEN="test-sentry-token-abc123"
SHA="deadbeefcafef00dfeed0000deadbeefcafef00d"

# --- 1. correct URLs and JSON, 208/409 "already exists" counts as OK -------------------------

run_script $'208\n201' \
  SENTRY_AUTH_TOKEN="$TOKEN" LMS_FRONT_GIT_COMMIT="$SHA"
if [ "$RUN_EXIT" -eq 0 ]; then pass "exits 0 on 208 (release) + 201 (deploy)"; else fail "exit code was $RUN_EXIT, not 0 ($RUN_OUT)"; fi
if [ "${#CALLS[@]}" -eq 2 ]; then pass "makes exactly 2 curl calls"; else fail "expected 2 curl calls, got ${#CALLS[@]}"; fi
if call_has 0 "https://de.sentry.io/api/0/organizations/master-education/releases/"; then
  pass "release URL is correct"
else
  fail "release URL missing or wrong: ${CALLS[0]:-<none>}"
fi
if call_has 0 "{\"version\": \"$SHA\", \"projects\": [\"lms-front\"]}"; then
  pass "release JSON body is correct"
else
  fail "release JSON body missing or wrong: ${CALLS[0]:-<none>}"
fi
if call_has 1 "https://de.sentry.io/api/0/organizations/master-education/releases/$SHA/deploys/"; then
  pass "deploy-marker URL is correct"
else
  fail "deploy-marker URL missing or wrong: ${CALLS[1]:-<none>}"
fi
if call_has 1 '{"environment": "production"}'; then
  pass "deploy-marker JSON body is correct"
else
  fail "deploy-marker JSON body missing or wrong: ${CALLS[1]:-<none>}"
fi

run_script $'409\n201' \
  SENTRY_AUTH_TOKEN="$TOKEN" LMS_FRONT_GIT_COMMIT="$SHA"
if [ "$RUN_EXIT" -eq 0 ]; then pass "exits 0 on 409 (release already exists) + 201 (deploy)"; else fail "exit code was $RUN_EXIT on 409, not 0 ($RUN_OUT)"; fi

# --- 2. the token appears only in the Authorization header ------------------------------------

run_script $'201\n201' \
  SENTRY_AUTH_TOKEN="$TOKEN" LMS_FRONT_GIT_COMMIT="$SHA"
for i in 0 1; do
  n="$(call_arg_count_containing "$i" "$TOKEN")"
  if [ "$n" -eq 1 ] && call_has "$i" "Authorization: Bearer $TOKEN"; then
    pass "call $i: token appears exactly once, in the Authorization header"
  else
    fail "call $i: token appeared in $n arg(s), expected exactly 1 in Authorization (${CALLS[$i]:-<none>})"
  fi
done
if ! printf '%s' "$RUN_OUT" | grep -qF -- "$TOKEN"; then
  pass "token never appears in the script's own stdout/stderr"
else
  fail "token leaked into script output: $RUN_OUT"
fi

# --- 3. an empty token skips -------------------------------------------------------------------

run_script "" SENTRY_AUTH_TOKEN="" LMS_FRONT_GIT_COMMIT="$SHA"
if [ "$RUN_EXIT" -eq 0 ]; then pass "empty token: exits 0"; else fail "empty token: exit code was $RUN_EXIT"; fi
if [ "${#CALLS[@]}" -eq 0 ]; then pass "empty token: no curl call made"; else fail "empty token: expected 0 curl calls, got ${#CALLS[@]}"; fi
if printf '%s' "$RUN_OUT" | grep -qi "skip"; then pass "empty token: prints a skip notice"; else fail "empty token: no skip notice in: $RUN_OUT"; fi

# --- 4. a 5xx doesn't fail it --------------------------------------------------------------------

run_script $'500\n502' SENTRY_AUTH_TOKEN="$TOKEN" LMS_FRONT_GIT_COMMIT="$SHA"
if [ "$RUN_EXIT" -eq 0 ]; then pass "5xx on both calls: still exits 0"; else fail "5xx: exit code was $RUN_EXIT, not 0 ($RUN_OUT)"; fi
if [ "${#CALLS[@]}" -eq 2 ]; then pass "5xx on release: the deploy-marker call still happens"; else fail "5xx: expected 2 curl calls, got ${#CALLS[@]}"; fi

# --- summary -------------------------------------------------------------------------------------

if [ "$FAILED" -eq 0 ]; then
  echo "All sentry-release.sh tests passed."
  exit 0
else
  echo "sentry-release.sh tests FAILED."
  exit 1
fi
