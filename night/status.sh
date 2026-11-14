#!/bin/bash
# Shows the state of every ticket, the pause (usage limit) and the last log lines.
cd "$(dirname "$0")/.." || exit 1
if [ -f night/state/run.pid ] && kill -0 "$(cat night/state/run.pid)" 2>/dev/null; then echo "RUNNING (pid $(cat night/state/run.pid))"; else echo "NOT RUNNING"; fi
[ -f night/state/state.json ] && node -e '
const s = require("./night/state/state.json")
if (s.pauseUntil > Date.now()) console.log("Paused by usage limit until", new Date(s.pauseUntil).toLocaleString())
for (const [id, t] of Object.entries(s.tickets)) console.log(id.padEnd(5), t.status.padEnd(8), "attempts", t.attempts, "-", (t.verdict?.summary ?? "").slice(0, 100))
'
echo; tail -n 15 night/logs/orchestrator.log 2>/dev/null
