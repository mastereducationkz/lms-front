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
# scripts/sentry-release.sh
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
# differ). A wrong-but-plausible release is worse than no release: whitespace-strip (a captured
# step output can carry a trailing newline) and then require exactly a 40-char lowercase-hex sha
# before using it for anything — anything else is a skip, never a guess.
RAW_VERSION="${LMS_FRONT_GIT_COMMIT:-}"
VERSION="$(printf '%s' "$RAW_VERSION" | tr -d '[:space:]')"
if ! printf '%s' "$VERSION" | grep -qE '^[0-9a-f]{40}$'; then
  echo "sentry-release: '${RAW_VERSION}' is not a 40-char lowercase-hex sha, skipping."
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
