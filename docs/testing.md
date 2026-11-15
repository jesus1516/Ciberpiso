# Testing

Everything below runs from the `app/` folder. Node 24 is required (the calculator check runs
TypeScript directly with `node`).

```bash
cd app
npm ci
```

| What | Command | Needs |
|---|---|---|
| Type check | `npx tsc -b` | – |
| Production build | `npm run build` | – |
| Calculator check (26 candidates, 0 differences) | `node scripts/check-calculator.ts` | – |
| Unit tests (Vitest) | `npm run test` | – |
| Unit tests in watch mode | `npm run test:watch` | – |
| End-to-end + layout tests (Playwright) | `npm run test:e2e` | Google Chrome installed, or `E2E_BROWSER=chromium` (see below) |
| Performance run (CPU ×4, Fast 3G) | `npm run build && PERF=1 E2E_BROWSER=chromium npx playwright test perf` | as above |
| Python pipeline tests | `python3 -m pytest tests -q` (repository root) | Python with pytest |

The same steps (without Python) run in GitHub Actions on every push and pull request:
`.github/workflows/ci.yml`.

## Unit tests (Vitest)

`npm run test` runs `src/**/*.test.ts` in Node, in well under a second.

- `src/lib/calculator.test.ts`: the calculator reproduces the pipeline scores, final scores
  and ranks of the 26 Antequera candidates with 0 differences (same logic as
  `scripts/check-calculator.ts`), plus edge cases: missing soil, missing soil fields, missing
  prices (no profit, no rank), blockers (never ranked), warnings and ranking ties (equal
  scores share a rank and the next rank is skipped).
- `src/explorer/scene.test.ts`: `tileFor`, `yearLetter`, `cropForYear` (observed years vs.
  scenario years) and the crop palette.
- `src/explorer/apt.test.ts`: the `apt` rules: which farms can be opened (`NOT_FARMLAND`
  cannot, `LIMITED` open with a warning, `null` is plain farmland).
- `src/explorer/insights.test.ts`: the ranked risks and opportunities of the farm view (T-07),
  on real farms and on edge cases.
- `src/explorer/tokens.test.ts`: the colour system (T-08): CSS and TypeScript tokens are
  identical, no stray colour literals, every text/UI pair meets WCAG AA (and the high-contrast
  pairs), colour-blind distances between the status colours.
- `src/explorer/sigpac.test.ts`: parsing SIGPAC references and municipality names for the search.

## End-to-end tests (Playwright)

`npm run test:e2e` builds the app (`vite build`), serves `dist/` with `vite preview` on
`127.0.0.1:4173` and runs the specs in `app/e2e/`. It reuses a preview server that is already
running on that port.

- **Browser**: locally the installed **Google Chrome** is used (`channel: 'chrome'`), so no
  browser is downloaded. In CI, `E2E_BROWSER=chromium` selects the bundled chromium, installed
  with `npx playwright install --with-deps chromium`. On a machine without Google Chrome (for
  example Linux) do the same locally: `npx playwright install --only-shell chromium`, then
  `E2E_BROWSER=chromium npx playwright test`. Headless runs draw WebGL with SwiftShader (on the
  CPU), so the full suite takes about 20 minutes there.
- **Fonts**: the e2e runs block Google Fonts like every other host, so text uses the system
  fallback fonts. Their glyph boxes differ between macOS and Linux; the contrast and layout
  checks measure the real rendering, so they catch overlaps that only show with one font.
- **No network needed**: every request to another host (map imagery, elevation tiles) is
  answered with a one-pixel PNG, so tests never depend on map imagery. The map data (GeoJSON,
  detail files) comes from `dist/data`.
- **Test hooks**: pages open with `?director`, which exposes `window.__xp`
  (`ctrl.go(level, { municipality, farm })`, `ctrl.setSpeed(50)`, `state`, `getFarm(id)`).
  Navigation helpers are in `e2e/helpers.ts`. No `data-testid` is used: tests locate things by
  role, text and existing class names.
- To run one spec or test: `npx playwright test e2e/flows.spec.ts -g "urban"` (after a build).
  Use `npx playwright test --headed` to watch it. Failure traces and screenshots are written
  to `<tmpdir>/ciberpiso-e2e/results` (override with `E2E_OUTPUT_DIR`; kept outside `node_modules` so `npm ci` never trips on it); `npx playwright show-trace <trace.zip>` opens one.

### Specs

| File | Covers |
|---|---|
| `flows.spec.ts` | Andalucía → Málaga → Antequera (29015) → farm 2900059683 → back to Andalucía (breadcrumb, Back button, Esc); Ronda (29084) and its farm 2900263939; clicking the urban farm 2900264015 with the real mouse shows a "Not farmland" warning and does not open it; Sources dialog. Every test also fails on console errors. |
| `layout.spec.ts` | At 1440×900, 1280×720, 1024×768 and 390×844, on every level (plus Ronda farm, the toast, the "Full data" sheet): visible panels (`.glass`, header, breadcrumb, back button, narrative, legend, dock, cards) must not overlap by more than 4 px, must stay inside the viewport, and text must not be cut off (`scrollWidth > clientWidth` on boxes that clip). |
| `layout-checker.spec.ts` | Self-test: the layout checker reports problems planted on purpose, so a green layout suite means something. |
| `a11y.spec.ts` | Document language and title; every visible button has an accessible name (both viewports, every level, the sheet and the dialog); images have `alt`; no console errors. |
| `colour.spec.ts` + `contrast.ts` | T-08: text contrast measured on the screenshot pixels against the real background (farm view, critical insight, map levels); colour is never the only signal (words, icons, letters, patterns). |
| `keyboard.spec.ts` | T-09: the whole journey with the keyboard only (lists, Enter, Esc, focus on each heading, live region), arrow keys in the lists, the "Full data" drawer and the Settings dialog trap and return focus, landmarks and headings, visible focus on every Tab stop. |
| `settings.spec.ts` | T-09: text size 125 / 150 %, high contrast and reduced motion (also the OS setting), saved and restored, broken `localStorage`, the data table, the 3D switched off; no overlaps with each setting on every level. |
| `touch.spec.ts` | T-09: on a phone every control is at least 44 × 44 px, also with 150 % text. |
| `perf.spec.ts` | T-05, opt-in (`PERF=1`): the journey under CPU ×4 and Fast 3G with long tasks, frame times and heap per phase. See `docs/performance.md`. |

### Layout checks and known failures

`e2e/layout.ts` measures the page in the browser. A problem is reported as a failing test with
the offending elements in the message, for example:

```
Overlapping panels at 390x844, level 3 · farm: button.back "Back Esc" overlaps header.fx-head ... by 80x28 px
```

Known problems are not silenced: they are listed in the `KNOWN` table of `e2e/layout.spec.ts`
and the test is marked with `test.fail(...)`. The suite is green while the problem exists and
turns red ("expected to fail, but passed") as soon as someone fixes it. When that happens,
delete the entry from `KNOWN`. Current known problems: **none**.

Panels inside a scrolling column (the farm column) are measured against that column, and the
farm column is checked again scrolled to the end.

The "Full data" sheet is a drawer that covers the farm view on purpose, so overlaps with it
are ignored; only its own box, and the text inside it, are checked.

## Adding tests

- Unit tests: a `*.test.ts` next to the code. Pure functions only; do not import three.js or
  maplibre (they need a browser).
- A new level or panel: add it to `PANEL_SELECTORS` in `e2e/layout.ts` if its class is not
  already matched, and add a scenario to `scenarios` in `e2e/layout.spec.ts`.
- If the layout suite reports something that is a real design decision, fix the selector, not
  the tolerance; if it is a bug, add it to `KNOWN` with a clear message instead of deleting the
  check.
