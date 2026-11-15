---
id: T-06
title: Farm view redesign - terrain on one side, all cards in a column
model: opus
effort: high
depends: ["T-01", "T-03"]
files: ["app/src/explorer/**", "app/e2e/**"]
maxAttempts: 2
timeoutMin: 150
---
## Goal
External advisers (farmers and agronomists) found the full-screen 3D block with floating cards
hard to read. Make the farm view functional first: the 3D terrain on one side and all the
information in a clear column on the other.

## Context
`app/src/explorer/FincaView.tsx` (React UI), `explorer.css`, `diorama.ts` (three.js; the camera
framing uses `framePadding()` and `isoView()`), `controller.ts` (map → 3D hand-off: the map
hands over a screen rectangle `tileRect` and a snapshot; keep that hand-off seamless).

## Task
1. Desktop (≥ 1100 px): a fixed information column (~420–480 px) on one side containing, top to
   bottom: farm header, the four indicator cards (water, soil, market, climate risk) stacked,
   the season timeline and the rotation selector. The 3D terrain fills the rest and is framed
   inside that area (update `framePadding()` so the block is centred in the free area).
   Tablet (760–1100): same idea, narrower column. Phone (< 760): terrain on top (~40 % height),
   scrollable column below.
2. Replace the leader lines crossing the screen with numbered markers on the terrain (1–4)
   that match a number on each card; hovering/focusing a card highlights its marker.
3. Keep: the satellite/model toggle, relief exaggeration, reset view, "full data" panel
   (it may open as a drawer over the column), the map → 3D entry animation and the exit.
4. Nothing may overlap at 1440×900, 1280×720, 1024×768 and 390×844 (check with the e2e layout
   tests from T-04 if they exist: `npm run test:e2e`).

## Tests
You may update `app/e2e/**` to match the new UI: remove `test.fail`/known-failure entries that
your change fixes, adapt selectors, and add viewports you are asked to check. Never weaken a
check to hide a real problem.

## Acceptance criteria
- [ ] Column + terrain layout on desktop, stacked on phones, no overlaps at the four sizes.
- [ ] Numbered markers replace the leader lines and stay attached to the terrain when orbiting.
- [ ] Entry/exit animations still work; the 3D block is centred in the free area.
- [ ] All checks pass; describe screenshots or measurements in the report.
