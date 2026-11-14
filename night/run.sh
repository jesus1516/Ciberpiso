#!/bin/bash
# Keeps the Mac awake and the orchestrator alive for the whole night.
# caffeinate: -d display, -i idle sleep, -m disk, -s system sleep on AC power, -u "user active".
# If the orchestrator crashes it is restarted after 60 s; it exits 0 when the queue is done or
# night/STOP exists.
cd "$(dirname "$0")/.." || exit 1
mkdir -p night/logs night/state
echo $$ > night/state/run.pid
caffeinate -dimsu -w $$ &
notify() { osascript -e "display notification \"$2\" with title \"Ciberpiso night\" subtitle \"$1\" sound name \"Glass\"" 2>/dev/null; }
while true; do
  node night/orchestrator.mjs "$@"
  code=$?
  [ $code -eq 0 ] && break
  [ -f night/STOP ] && break
  notify "Orchestrator crashed" "Exit code $code, restarting in 60 s"
  sleep 60
done
rm -f night/state/run.pid
