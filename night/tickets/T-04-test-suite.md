---
id: T-04
title: Automated tests - unit, end to end and layout overlap checks
model: sonnet
effort: high
depends: []
files: ["app/package.json", "app/package-lock.json", "app/vitest.config.ts", "app/playwright.config.ts", "app/e2e/**", "app/src/**/*.test.ts", "app/scripts/**", ".github/workflows/**", "docs/testing.md"]
maxAttempts: 2
timeoutMin: 150
---
## Goal
A test suite that catches broken behaviour and overlapping or cut-off UI, so later tickets
(and humans) can change the app with confidence. Runs locally and in GitHub Actions.

## Task
1. Unit tests with Vitest (`npm run test` → `vitest run`):
   - `lib/calculator.ts`: reuse the logic of `scripts/check-calculator.ts` (26 candidates,
     0 differences) plus edge cases (missing soil, missing prices, ranking ties).
   - Pure helpers in `app/src/explorer` (`escena.ts`: `tileFor`, `cropForYear`, year letters)
     and the `apt` rules (which farms can be opened).
2. End-to end tests with Playwright (`npm run test:e2e`), against `vite preview` of the build:
   - Use the installed Google Chrome locally (`channel: 'chrome'`) so nothing is downloaded on
     this machine (disk is almost full); in CI install chromium.
   - The app exposes test hooks with `?director` (`window.__xp.ctrl.go(level, {...})`,
     `window.__xp.state`, `window.__xp.getFinca(id)`), use them to reach each level fast
     (`ctrl.setSpeed(50)`).
   - Flows: Andalucía → Málaga → Antequera (29015) → farm 2900059683 → back to Andalucía;
     a municipality outside Antequera (Ronda 29084) and a farm there (2900263939);
     clicking a non-farmland farm (urban 2900264015) shows a warning and does not open it.
   - Layout checks at 1440×900 and 390×844 on every level: visible panels (`.glass`, header,
     breadcrumb, back button, cards, dock, legend) must not overlap each other more than a few
     pixels and must stay inside the viewport; text must not be clipped
     (`scrollWidth > clientWidth` on labels). Report each overlap found as a failing test with
     a clear message instead of silencing it; mark known failures with `test.fail` and list
     them in the report so T-10 can fix them.
   - Basic accessibility smoke: every button has an accessible name; no console errors.
   - Tests must not depend on map imagery being loaded (tiles come from the network).
3. GitHub Actions workflow `.github/workflows/ci.yml`: on push/PR run `npm ci`, `tsc -b`,
   build, calculator check, unit tests, and e2e with chromium.
4. `docs/testing.md`: how to run everything (in English).

## Acceptance criteria
- [ ] `npm run test` passes.
- [ ] `npm run test:e2e` runs locally with Chrome; failures are only the known, documented
      layout/accessibility problems marked `test.fail`.
- [ ] No source file outside the allowed list was edited (no `data-testid` added to components:
      use roles, text and existing classes).
