---
id: T-08
title: Accessible colour system - fewer colours, enough contrast, never colour alone
model: sonnet
effort: high
depends: ["T-07"]
files: ["app/src/explorer/**", "app/src/index.css", "app/e2e/**"]
maxAttempts: 2
timeoutMin: 120
---
## Goal
The accessibility team warned about too many colours mixed together. Make the palette calm,
readable and safe for colour-blind users.

## Task
1. Audit every colour in `explorer.css`, `escena.ts` (crop colours), `controller.ts` (map layer
   colours) and `diorama.ts` (3D materials). Write the audit as a table in the report.
2. Define a small token set (CSS custom properties) and use it everywhere: one accent, one
   neutral scale, and status colours good / warning / critical chosen to be distinguishable
   with deuteranopia and protanopia (e.g. blue / orange / magenta-red, verified with a simulator
   formula, not by eye).
3. Text contrast ≥ 4.5:1 (≥ 3:1 for large text and UI components) against its real background.
   Compute the ratios and list them in the report.
4. Never use colour as the only signal: severity and scores also get an icon or a word
   (High / Medium / Low), map legend swatches get patterns or labels, crop colours in the
   timeline get the crop initial or a tooltip.
5. Reduce the number of distinct crop colours shown at once (group similar classes).

## Tests
You may update `app/e2e/**` to match the new UI: remove `test.fail`/known-failure entries that
your change fixes, adapt selectors, and add viewports you are asked to check. Never weaken a
check to hide a real problem.

## Acceptance criteria
- [ ] Token-based palette; no stray hex colours left in `app/src/explorer` except the token
      definitions (list justified exceptions such as satellite shader constants).
- [ ] Contrast table with all text/UI pairs ≥ the WCAG AA thresholds.
- [ ] Every colour-coded meaning has a non-colour cue. All checks pass.
