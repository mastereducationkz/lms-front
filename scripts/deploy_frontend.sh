#!/usr/bin/env bash
# Replaces the frontend container without refusing a request, and without deleting the files the
# tabs already open still load (owner Q53 = a, 2026-10-07).
#
# `docker compose up -d lms-frontend` used to stop the container before the new one served (1-5
# failed requests per deploy on 2026-10-07), and the new image no longer had the previous build's
# hashed /assets: a tab opened before the deploy 404'd on its next lazy route (501 times in 5 h)
# and had to reload. Now:
#
#   1. the running build's /assets are copied into the lms-frontend-old-assets volume (dated now),
#      and files no build has shipped for 14 days are deleted; nginx.conf falls back to this volume
#      for any /assets file the current build lacks;
#   2. the new image starts as lms-frontend-standby, next to lms-frontend, on the same VIRTUAL_HOST;
#   3. once it serves / from the new image, lms-frontend is recreated (nginx finishes what it is
#      serving and refuses new connections, which nginx-proxy retries on the standby);
#   4. once the new lms-frontend serves, the standby is stopped the same way and removed.
#
# A standby that never serves is removed and lms-frontend (the previous build) never stopped; the
# script exits non-zero. Each container lingers 5 s after nginx stops (scripts/nginx-entrypoint.sh).
#
# Usage, from ~/projects/lms-frontend once `docker compose build lms-frontend` built the new image:
#   bash scripts/deploy_frontend.sh
# DEPLOY_HEALTH_TIMEOUT (seconds, default 60) bounds each wait.
set -euo pipefail

TIMEOUT="${DEPLOY_HEALTH_TIMEOUT:-60}"
# After a refused connection nginx-proxy leaves that container out for 10 s (its default
# fail_timeout), and a starting container refuses until nginx listens. Each handover waits this
# long after the new container first serves, so the other one is never the only one ruled out.
SETTLE="${DEPLOY_SETTLE_SECONDS:-15}"
KEEP_DAYS="${OLD_ASSETS_DAYS:-14}"
IMAGE=lms-frontend:latest
VOLUME=lms-frontend-old-assets
PRIMARY=lms-frontend
STANDBY=lms-frontend-standby

log() { printf '%s %s\n' "$(date -u +%H:%M:%S)" "$*"; }

running() { [ "$(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null)" = true ]; }

serves() { docker exec "$1" wget -q -O /dev/null http://127.0.0.1/ >/dev/null 2>&1; }

# Waits until CONTAINER serves / from the image just built.
wait_serving() {
  local deadline=$((SECONDS + TIMEOUT)) want
  want="$(docker image inspect -f '{{.Id}}' "$IMAGE")"
  while [ "$SECONDS" -lt "$deadline" ]; do
    # Dead or restarting (a broken config exits nginx at once, and the restart policy loops it).
    if ! running "$1" || [ "$(docker inspect -f '{{.RestartCount}}' "$1")" != 0 ]; then
      log "❌ $1 is not running"
      return 1
    fi
    if [ "$(docker inspect -f '{{.Image}}' "$1")" != "$want" ]; then
      log "❌ $1 does not run the image just built"
      return 1
    fi
    if serves "$1"; then
      return 0
    fi
    sleep 1
  done
  log "❌ $1 did not serve / within ${TIMEOUT}s"
  return 1
}

# `stop` first: it sends SIGQUIT and waits the stop_grace_period, `rm -f` alone would kill.
remove_standby() {
  docker compose --profile standby stop lms-frontend-standby || true
  docker compose --profile standby rm -f lms-frontend-standby || true
}

# Copies the /assets of the build CONTAINER serves into the volume, dated now, and drops the files
# no build has shipped for KEEP_DAYS days.
keep_assets_of() {
  log "📦 Keeping the assets of the build ${1} serves for ${KEEP_DAYS} days..."
  docker exec "$1" tar -C /usr/share/nginx/html -cf - assets \
    | docker run --rm -i --network none -v "$VOLUME:/srv/old-assets" --entrypoint sh "$IMAGE" -c \
      "tar -C /srv/old-assets -xmf - && find /srv/old-assets -type f -mtime +${KEEP_DAYS} -delete && echo \"  \$(find /srv/old-assets -type f | wc -l) files kept\""
}

docker compose config -q
docker image inspect "$IMAGE" >/dev/null
# nginx-proxy routes to a container the moment it runs, healthy or not. So the new image first
# serves / off the network (loopback only): a config error or a missing index.html stops the
# deploy here, before any user request can reach it.
if ! docker run --rm --network none --entrypoint sh "$IMAGE" -c \
    'nginx && wget -q -O /dev/null http://127.0.0.1/' >/dev/null; then
  log "❌ The new image does not serve / (tested off the network); nothing was changed"
  exit 1
fi

if running "$PRIMARY" && serves "$PRIMARY"; then
  # Created, not started: this also creates the volume, and nothing reaches the standby before the
  # previous build's assets are in it.
  docker compose --profile standby create --no-build --force-recreate lms-frontend-standby
  keep_assets_of "$PRIMARY" || log "⚠️  The previous build's assets were not kept: its open tabs will reload"
  log "🟢 Starting the new build as ${STANDBY}, next to ${PRIMARY}..."
  docker compose --profile standby start lms-frontend-standby
  if ! wait_serving "$STANDBY"; then
    docker logs --tail 40 "$STANDBY" 2>&1 | sed 's/^/    /' || true
    remove_standby
    log "❌ The new build never served. ${PRIMARY} (the previous build) kept serving throughout."
    exit 1
  fi
  log "✅ ${STANDBY} is serving"
  sleep "$SETTLE"
elif running "$STANDBY" && serves "$STANDBY"; then
  # A deploy stopped after its standby took over: the standby is what is serving, so it covers this one.
  log "⚠️  ${PRIMARY} is not serving; ${STANDBY} serves while it is replaced"
  keep_assets_of "$STANDBY" || log "⚠️  The previous build's assets were not kept: its open tabs will reload"
else
  log "⚠️  Neither ${PRIMARY} nor ${STANDBY} is serving: nothing to keep serving, replacing ${PRIMARY} directly"
fi

log "🔁 Replacing ${PRIMARY}..."
docker compose up -d --no-build --no-deps lms-frontend
if ! wait_serving "$PRIMARY"; then
  docker logs --tail 40 "$PRIMARY" 2>&1 | sed 's/^/    /' || true
  running "$STANDBY" && log "❌ ${PRIMARY} did not come up. ${STANDBY} is serving alone;" \
    "the next deploy replaces ${PRIMARY} and then removes it."
  exit 1
fi
log "✅ ${PRIMARY} is serving"

if docker inspect "$STANDBY" >/dev/null 2>&1; then
  sleep "$SETTLE"
  log "🧹 Stopping ${STANDBY}..."
  remove_standby
fi
log "✅ Deployed"
