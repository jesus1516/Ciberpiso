#!/bin/bash
# Graceful stop: no new tickets start; running agents finish their current attempt.
# Use "night/stop.sh --now" to kill everything immediately.
cd "$(dirname "$0")/.." || exit 1
touch night/STOP
if [ "$1" = "--now" ] && [ -f night/state/run.pid ]; then
  pkill -P "$(cat night/state/run.pid)" 2>/dev/null; kill "$(cat night/state/run.pid)" 2>/dev/null
  pkill -f "night/orchestrator.mjs" 2>/dev/null
  echo "Stopped now."
else
  echo "Stop requested: running tickets finish their attempt, then the shift ends."
fi
