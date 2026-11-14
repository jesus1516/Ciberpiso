# Night shift: tickets as contracts for coding agents

Unattended work for the night: each ticket in `night/tickets/` is a contract that one headless
Claude Code agent fulfils on its own branch. A second agent reviews it, and approved work is
merged into `night/integration`. **Nothing is merged into `main` automatically**: in the morning
the team reviews one draft PR `night/integration → main`.

## How it works

```
tickets/T-XX.md ──► orchestrator ──► slot worktree (branch night/T-XX) ──► worker agent
                         │                                                    │ commits + report
                         │◄──── checks (tsc, build, calculator, tests) ◄──────┘
                         │◄──── reviewer agent (read-only verdict)
                         └──► approved: merge into night/integration, push, notify
                              rejected: retry with feedback (max 2), then "blocked"
```

- **Contracts**: each ticket lists its goal, the only files it may touch, acceptance criteria,
  dependencies, model and time limit. Changing a file outside the list fails the ticket.
- **No collisions**: every agent works in its own git worktree (`../Ciberpiso-night/slot-N`,
  sparse: the large CSVs are left out to save disk). Two tickets only run at the same time if
  their file lists cannot overlap, and a ticket starts only when its dependencies are merged.
- **Communication**: every agent writes `night/reports/T-XX.md` (what changed, how it was
  verified, progress, handoff). Later agents read the merged reports; anything outside a
  ticket's files goes to "Handoff" for another ticket or a human.
- **Fresh context**: every attempt is a new session. If a session is cut (usage limit, timeout),
  the next one continues from the branch's commits and the report's "Progress" section.
- **Usage limits**: when an agent hits the plan's usage limit, the whole shift pauses, probes
  every 30 minutes with a tiny request, and resumes automatically when the limit resets (up to
  7 hours of waiting). Notifications are shown on the Mac.
- **Safety**: agents cannot `git push`, run `gh`, `sudo`, or check out `main`; the reviewer
  cannot edit files. Only the orchestrator pushes, and only `night/*` branches.

## Models

Mechanical, well-specified tickets and the reviewer use **Sonnet** (cheaper, enough quality).
Open-ended design and diagnosis tickets (T-05 performance, T-06 farm layout, T-07 key insights)
use **Opus**.

## Commands (from the repository root)

| Command | What it does |
|---|---|
| `night/start.sh` | Start the shift in the background (keeps the Mac awake with `caffeinate`) |
| `night/start.sh --only T-00` | Run a single ticket (smoke test) |
| `night/status.sh` | Status of every ticket, pause state, last log lines |
| `night/stop.sh` | Graceful stop after the running attempts finish (`--now` to kill) |
| `tail -f night/logs/orchestrator.log` | Follow the orchestrator |

Logs of every agent session are in `night/logs/T-XX-aN-worker.log` / `-verifier.log`; state in
`night/state/state.json` (delete it to start the queue from scratch).

## Requirements

Node 20+, git, an authenticated `claude` CLI and `gh`. Keep the Mac on AC power with the lid
open: `caffeinate` prevents idle and display sleep, but closing the lid sleeps a MacBook.
