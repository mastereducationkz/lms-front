#!/bin/sh
# PID 1 of the lms-frontend container: nginx (through the image's own /docker-entrypoint.sh) runs
# as a child, so that a stop is graceful and then lingers (scripts/deploy_frontend.sh).
#
# On SIGQUIT (the image's stop signal) or SIGTERM, nginx closes its listening socket and finishes
# the requests in flight; nginx-proxy retries refused connections on the other container. Then the
# container stays up LINGER_SECONDS more, refusing, so nginx-proxy rules it out before it exits:
# once it exits its address stops answering at all, and a request sent there before nginx-proxy
# reloads waits out the connect timeout instead of being retried at once.
LINGER_SECONDS=5

/docker-entrypoint.sh "$@" &
child=$!
stopping=
stop() {
  stopping=1
  kill -QUIT "$child" 2>/dev/null
}
trap stop QUIT TERM INT

# `wait` returns early when a trapped signal arrives: wait until nginx itself has exited.
status=0
while kill -0 "$child" 2>/dev/null; do
  wait "$child"
  status=$?
done
if [ -n "$stopping" ]; then
  echo "nginx stopped; refusing connections for ${LINGER_SECONDS} s before exiting"
  sleep "$LINGER_SECONDS"
  status=0
fi
exit "$status"
