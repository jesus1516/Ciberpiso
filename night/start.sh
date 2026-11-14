#!/bin/bash
# Starts the night shift in the background. It survives closing the Terminal window.
cd "$(dirname "$0")/.." || exit 1
if [ -f night/state/run.pid ] && kill -0 "$(cat night/state/run.pid)" 2>/dev/null; then
  echo "Already running (pid $(cat night/state/run.pid)). Use night/status.sh"; exit 1
fi
rm -f night/STOP
mkdir -p night/logs night/state
nohup night/run.sh "$@" >> night/logs/run.log 2>&1 &
sleep 1
echo "Night shift started (pid $(cat night/state/run.pid 2>/dev/null)). Logs: night/logs/orchestrator.log"
echo "Keep the lid OPEN and the charger plugged in: closing the lid sleeps the Mac anyway."
