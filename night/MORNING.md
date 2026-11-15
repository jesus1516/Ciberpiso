# Night shift summary

Started 2026-11-14 23:48:05, updated 2026-11-15 04:03:18.

| Ticket | Title | Model | Status | Attempts | Last verdict |
|---|---|---|---|---|---|
| T-00 | Smoke test - English page metadata | sonnet | done | 1 | The diff touches only app/index.html and the report. In index.html, lang is "en", the title is "Ciberpiso · From territory to farm", and the description is a fa |
| T-01 | Translate the whole web app UI to English | sonnet | done | 1 | T-01 meets its contract. The orchestrator's tsc, build, calculator check (0 differences), oxlint and test checks all pass. The Python pytest failure is only a m |
| T-02 | Translate documentation, pipeline and tests to English | sonnet | done | 2 | T-02 meets its contract. I swept README.md, docs/*.md, data/README.md, pipeline/*.py and tests/*.py for Spanish prose in comments, docstrings and messages. The  |
| T-03 | Remove the word NASA from the repository and the web | sonnet | blocked | 2 | The web app (`app/src`, `app/index.html`) is clean. The diff rephrases prose neutrally and leaves URLs and identifiers alone. The calculator check, build, tsc,  |
| T-04 | Automated tests - unit, end to end and layout overlap checks | sonnet | done | 1 | T-04 meets its contract. I re-ran `npm run test` and all 50 Vitest tests passed. I did not re-run the Playwright suite. The T-04 commits add only test files, `v |
| T-05 | Performance on slow computers | opus | pending | 0 |  |
| T-06 | Farm view redesign - terrain on one side, all cards in a column | opus | pending | 0 |  |
| T-07 | Farm view - surface what really matters for this farm | opus | pending | 0 |  |
| T-08 | Accessible colour system - fewer colours, enough contrast, never colour alone | sonnet | pending | 0 |  |
| T-09 | Accessibility - keyboard, screen readers, text size, contrast mode | sonnet | pending | 0 |  |
| T-10 | Bug sweep - run every test, fix overlaps and errors | sonnet | pending | 0 |  |
| T-11 | Viability report - extending the app to all of Andalucia | sonnet | done | 1 | T-11 delivers a complete English viability report (docs/andalucia-viability.md) with all required sections: data per province, output size and hosting options w |

Every ticket has its own branch `night/T-XX` and report in `night/reports/`. Approved tickets are merged into `night/integration`; nothing is merged into `main` automatically.
