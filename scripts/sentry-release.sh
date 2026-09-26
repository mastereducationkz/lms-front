#!/usr/bin/env bash
# Registers this deploy's Sentry release and a "production" deploy marker, so an issue Sentry
# already resolved in this release doesn't get reopened as a "regression" by a stray event from
# an old bundle (see WS9 Addendum A / the LMS-FRONT-1 incident). Called from
# .github/workflows/deploy-frontend.yml, on the GitHub Actions RUNNER (not the production server —
# fix round 1: the token must never reach the deploy host, where any process on the box could read
# it out of `ps`), AFTER the frontend container has actually been rebuilt and restarted, using the
# exact sha the workflow read back from the server. Never in a way that can fail or slow the
# deploy: every request is capped at $CURL_MAX_TIME seconds, a non-2xx response is logged and
# ignored, and a missing token or a sha that isn't a real commit hash is a silent, deliberate skip.
#
# Run manually for a spot check: SENTRY_AUTH_TOKEN=... LMS_FRONT_GIT_COMMIT=<40-char sha> bash
# scripts/sentry-release.sh (a bare sha or a "SENTRY_SHA=<sha>" line both work — see below).
#
# No `set -e`: a failed `curl` must not abort the script (see run_curl below). No `set -x` and no
# `-v`/`--trace*` on curl, ever. The token is fed to curl via `--config -` on stdin (see run_curl)
# so it is NEVER a curl argv element — not even on the runner, where argv is far less exposed than
# it would be on the shared production host, but still visible to anything reading /proc or `ps`
# on the same machine while the request is in flight.
set -uo pipefail

SENTRY_API_BASE="${SENTRY_API_BASE:-https://de.sentry.io}"
SENTRY_ORG="${SENTRY_ORG:-master-education}"
SENTRY_PROJECT="${SENTRY_PROJECT:-lms-front}"
SENTRY_ENVIRONMENT="${SENTRY_ENVIRONMENT:-production}"
CURL_MAX_TIME="${CURL_MAX_TIME:-15}"

if [ -z "${SENTRY_AUTH_TOKEN:-}" ]; then
  echo "sentry-release: SENTRY_AUTH_TOKEN is empty, skipping release/deploy marker."
  exit 0
fi

# The exact sha the build used. The caller MUST pass LMS_FRONT_GIT_COMMIT — the workflow reads
# this back from the server's checkout right after the deploy (see the "Get deployed commit"
# step) — so it's the value the build actually used, not a value trusted to have stayed in sync
# with it. Fix round 2: there is deliberately no `git rev-parse HEAD` fallback here anymore. There
# used to be one, "for a manual run from a real checkout" — but in CI, the runner's OWN checkout
# (added later, for scripts/sentry-release.sh itself to exist) is ALSO a real git repo, so when
# the SSH capture silently came back empty (an `appleboy/ssh-action` version without
# `capture_stdout` — see the workflow's comment on that step), this fallback didn't fail loudly;
# it quietly substituted the RUNNER's sha, which is not necessarily what the SERVER actually
# deployed (the server builds master's tip at deploy time, and deploys queue — those two shas can
# differ). A wrong-but-plausible release is worse than no release.
#
# Fix round 3: LMS_FRONT_GIT_COMMIT is not just a sha either. appleboy/ssh-action's entrypoint
# runs drone-ssh, which always appends its own success banner to the SAME stdout stream
# capture_stdout reads (confirmed against drone-ssh 1.8.2's own source: it `tee`s that banner to
# the captured output unconditionally) — so the real captured value looks like
# "<sha>\n===\n✅ Successfully executed commands to all hosts.\n===", not a bare sha, and the old
# whole-string regex match against that never matched anything at all (this made EVERY prod run
# skip silently — the bash test only ever fed it a bare sha, so it never caught this). Look for a
# line that's exactly a 40-char lowercase-hex sha, on its own, prefixed with "SENTRY_SHA=" (the
# marker the workflow's "Get deployed commit" step now prints).
#
# Fix round 4: a bare sha with no marker is trusted ONLY when the whole captured value is a single
# line — the documented manual-run shape, where there's nothing else in the capture it could be
# confused with. In CI, the capture is always multiple lines (the banner rides along even on
# success), so a bare 40-hex line there is NOT accepted, even if one shows up — it could be
# unrelated noise from the SSH session itself (a `.bashrc` line, a MOTD, some other tool's output)
# that happens to look like a sha, and if the real marker came back empty (say `git rev-parse`
# failed with "dubious ownership" and printed nothing after "SENTRY_SHA="), trusting a stray bare
# sha would register the WRONG release with no indication anything went wrong. Either way, require
# EXACTLY ONE distinct matching value: none is the existing skip, and more than one distinct sha
# is a signal something is wrong with the capture, not a "pick one and hope" situation.
RAW_OUTPUT="${LMS_FRONT_GIT_COMMIT:-}"
NORMALIZED="$(printf '%s' "$RAW_OUTPUT" | tr -d '\r')"
NONBLANK_LINES="$(printf '%s\n' "$NORMALIZED" | grep -c '[^[:space:]]' || true)"
if [ "$NONBLANK_LINES" -le 1 ]; then
  SHA_PATTERN='^(SENTRY_SHA=)?[0-9a-f]{40}$'
else
  SHA_PATTERN='^SENTRY_SHA=[0-9a-f]{40}$'
fi
CANDIDATES="$(printf '%s\n' "$NORMALIZED" | grep -oE "$SHA_PATTERN" | sed -E 's/^SENTRY_SHA=//' | sort -u)"
CANDIDATE_COUNT=0
if [ -n "$CANDIDATES" ]; then
  CANDIDATE_COUNT="$(printf '%s\n' "$CANDIDATES" | wc -l | tr -d ' ')"
fi
if [ "$CANDIDATE_COUNT" -ne 1 ]; then
  echo "sentry-release: expected exactly one 40-char lowercase-hex sha in the captured output, found ${CANDIDATE_COUNT}; skipping."
  exit 0
fi
VERSION="$CANDIDATES"
# Belt and suspenders: the extraction above already guarantees this shape by construction, but
# validate again rather than trust it silently held.
if ! printf '%s' "$VERSION" | grep -qE '^[0-9a-f]{40}$'; then
  echo "sentry-release: extracted value '${VERSION}' is not a 40-char lowercase-hex sha, skipping."
  exit 0
fi

# POSTs $2 as JSON to $1, capped at $CURL_MAX_TIME seconds, and prints only the HTTP status code
# (the response body is discarded — we don't need it and don't want it in the deploy log). The
# Authorization header comes from a curl config block piped in on stdin (`--config -`), which
# keeps the token out of argv entirely; verified locally against a real local HTTP server that a
# `ps` snapshot taken mid-request shows no trace of it (see the PR description / task report).
run_curl() {
  local url="$1" data="$2"
  printf 'header = "Authorization: Bearer %s"\n' "$SENTRY_AUTH_TOKEN" |
    curl -sS --max-time "$CURL_MAX_TIME" -o /dev/null -w '%{http_code}' \
      --config - \
      -X POST "$url" \
      -H "Content-Type: application/json" \
      -d "$data"
}

release_url="${SENTRY_API_BASE}/api/0/organizations/${SENTRY_ORG}/releases/"
release_data=$(printf '{"version": "%s", "projects": ["%s"]}' "$VERSION" "$SENTRY_PROJECT")
release_code="$(run_curl "$release_url" "$release_data")"
case "$release_code" in
  2* | 409)
    # 2xx: created. 409 (and Sentry's non-standard 208): the release already exists — also fine.
    echo "sentry-release: release ${VERSION} ok (HTTP ${release_code})."
    ;;
  *)
    echo "sentry-release: release creation for ${VERSION} returned HTTP ${release_code}; continuing anyway."
    ;;
esac

deploy_url="${SENTRY_API_BASE}/api/0/organizations/${SENTRY_ORG}/releases/${VERSION}/deploys/"
deploy_data=$(printf '{"environment": "%s"}' "$SENTRY_ENVIRONMENT")
deploy_code="$(run_curl "$deploy_url" "$deploy_data")"
case "$deploy_code" in
  2*)
    echo "sentry-release: deploy marker for ${VERSION} ok (HTTP ${deploy_code})."
    ;;
  *)
    echo "sentry-release: deploy marker for ${VERSION} returned HTTP ${deploy_code}; continuing anyway."
    ;;
esac

exit 0
