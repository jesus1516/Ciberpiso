---
id: T-10
title: Bug sweep - run every test, fix overlaps and errors
model: sonnet
effort: high
depends: ["T-05"]
files: ["app/src/**", "app/e2e/**", "app/index.html", "docs/testing.md"]
maxAttempts: 2
timeoutMin: 150
---
## Goal
Leave the app with zero known errors after the night's changes.

## Task
1. Run the unit tests, the e2e suite (`npm run test:e2e`), the build and the linter.
2. Fix every failure, every overlap/clipping found by the layout checks (including the ones
   marked `test.fail` by T-04: remove the marker once fixed), every console error, and every
   problem listed under "Handoff" in the night reports that falls inside your files.
3. Walk the journey in the e2e browser at 1440×900 and 390×844 and fix visual problems
   (screenshots are for you; do not commit them).

## Acceptance criteria
- [ ] Unit + e2e suites fully green without `test.fail` markers (or each remaining one justified
      in the report as out of scope).
- [ ] No console errors on the full journey. All checks pass.
