#!/usr/bin/env bash
# Registers this deploy's Sentry release and a "production" deploy marker, so an issue Sentry
# already resolved in this release doesn't get reopened as a "regression" by a stray event from
# an old bundle (see WS9 Addendum A / the LMS-FRONT-1 incident). Called from
# .github/workflows/deploy-frontend.yml, on the server, AFTER the frontend container has actually
# been rebuilt and restarted — never before, and never in a way that can fail or slow the deploy:
# every request is capped at $CURL_MAX_TIME seconds, a non-2xx response is logged and ignored,
# and a missing token is a silent, deliberate skip.
#
# Run manually for a spot check: SENTRY_AUTH_TOKEN=... LMS_FRONT_GIT_COMMIT=<sha> bash
# scripts/sentry-release.sh
#
# No `set -e`: a failed `curl` must not abort the script (see run_curl below). No `set -x` and no
# `-v`/`--trace*` on curl, ever — the token must never be echoed, only sent in the Authorization
# header.
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

# The exact sha the build used. The caller passes LMS_FRONT_GIT_COMMIT (re-derived right before
# calling this script, in the same already-deployed checkout — see the workflow); falling back to
# `git rev-parse HEAD` here covers a manual/local run from that same checkout.
VERSION="${LMS_FRONT_GIT_COMMIT:-}"
if [ -z "$VERSION" ]; then
  VERSION="$(git rev-parse HEAD 2>/dev/null || true)"
fi
if [ -z "$VERSION" ]; then
  echo "sentry-release: could not determine the release sha, skipping."
  exit 0
fi

# POSTs $2 as JSON to $1 with the auth header, capped at $CURL_MAX_TIME seconds, and prints only
# the HTTP status code (the response body is discarded — we don't need it and don't want it in
# the deploy log). The token appears in exactly one place: the Authorization header value.
run_curl() {
  local url="$1" data="$2"
  curl -sS --max-time "$CURL_MAX_TIME" -o /dev/null -w '%{http_code}' \
    -X POST "$url" \
    -H "Authorization: Bearer ${SENTRY_AUTH_TOKEN}" \
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
