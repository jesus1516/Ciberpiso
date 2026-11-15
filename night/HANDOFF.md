# Night shift hand-off (written 2026-11-15, ~10:30)

Read `night/README.md` first (how the system works). This file is the live state for whoever
continues, human or agent. Everything below is already on GitHub.

## Where things are

| What | Where |
|---|---|
| Infrastructure and ticket contracts | `main`, folder `night/` |
| Approved work from tickets | branch **`night/integration`** (draft PR #2 → `main`) |
| Each ticket's own work | branches `night/T-XX` (reports in `night/reports/T-XX.md` on those branches) |
| Nothing has been merged into `main` automatically | the team reviews PR #2 |

## Ticket status

| Ticket | Status | Notes |
|---|---|---|
| T-00 smoke test | done | |
| T-01 UI in English | done | |
| T-02 docs/pipeline/tests in English | done | |
| T-03 remove the word NASA | done | official hackathon PDFs/PNGs keep it in file names (human decision) |
| T-04 test suite (Vitest + Playwright + CI) | done | |
| T-06 farm view: terrain + info column | done | |
| T-07 key insights first | done | |
| T-08 accessible colour system | done | |
| T-09 accessibility | done | finished by hand after the shift was stopped; `night/reports/T-09.md` |
| T-05 performance | done (partial) | data parsed in workers, no shader checks in production; the 200 ms target is not met under headless SwiftShader. `docs/performance.md`, `night/reports/T-05.md` |
| T-10 bug sweep | done | full e2e suite green on the combined app; `night/reports/T-10.md` |
| T-11 Andalucía viability | done | `docs/andalucia-viability.md`; implementation deliberately NOT started |

## Update (2026-11-15, after the shift)

The shift on the Mac was stopped and the remaining tickets were finished by hand. `night/integration`
now also contains `feat/one-rotation-engine` (SIGPAC search, single rotation engine; its search
moved into the masthead row) and the rename of the page to **AgroSpace** with the agrospace logo.
Every ticket is done; nothing is left for the orchestrator. PR #2 (`night/integration` → `main`)
is ready for review.

## How to continue

- **Mac still running the shift:** `night/status.sh` shows everything; it resumes by itself after
  usage limits (it probes every 30 min). Stop with `night/stop.sh`.
- **From another machine/agent:** the run state (`night/state/state.json`) is local and ignored by
  git, so start fresh on the remaining tickets: set `"slots": 1` in `night/config.json` (disk), mark
  finished tickets as done by creating `night/state/state.json` with their ids as
  `{"tickets": {"T-00": {"status": "done", "attempts": 1, "history": []}, ...}, "pauseUntil": 0}`,
  then `night/start.sh`. T-09 will resume from branch `night/T-09` automatically.
- **Or by hand:** continue T-09 on `night/T-09` following `night/tickets/T-09-accessibility.md`,
  run the checks listed in `night/config.json`, merge into `night/integration`, then T-05, T-10.

## Known facts and gotchas

- Hard checks: `tsc -b`, `npm run build`, `node scripts/check-calculator.ts` (0 differences). The
  `pytest` suite shows errors in sparse worktrees because `data/processed/scenarios.csv` is not
  versioned: that is the baseline, not a regression.
- Disk was very tight (< 1 GB free); worktrees are sparse (no `data/andalucia`, `data/malaga`).
- UI tickets may edit `app/e2e/**`; never weaken a check to hide a real problem.
- Pending human decisions: delete the old unused map/panel components (MapView, FincaPicker,
  Dashboard...), whether to keep the `night/` tooling after the shift (it names the word NASA in
  its contracts), Andalucía extension (see viability report), and branch protection on `main`.
