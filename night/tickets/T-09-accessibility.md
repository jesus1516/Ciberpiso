---
id: T-09
title: Accessibility - keyboard, screen readers, text size, contrast mode
model: sonnet
effort: high
depends: ["T-08"]
files: ["app/src/**", "app/index.html", "app/e2e/**"]
maxAttempts: 2
timeoutMin: 150
---
## Goal
The Space Apps challenge values accessibility. A person using only a keyboard or a screen
reader, or who needs larger text or less motion, must be able to complete the whole journey:
choose Málaga, a municipality, a farm, and understand its results.

## Task
1. Keyboard alternative to the map: on each level, an accessible list (searchable combobox or
   listbox) of the provinces / municipalities / farms of the current view, reachable with Tab,
   that triggers the same transitions as clicking. For farms, list farmland farms sorted by
   area with candidates first (non-farmland ones are not listed). Visible focus everywhere.
2. Screen readers: announce level changes and transitions (`aria-live`), give the map region a
   summary, and provide a data table alternative to the 3D view (indicators per rotation).
3. Settings menu (persisted in localStorage, wrapped in try/catch): text size (100/125/150 %),
   high-contrast mode, reduce motion (also honour `prefers-reduced-motion`, which already skips
   the transitions), and pause/disable the 3D (show the data table instead) for slow devices.
4. Focus management: after each transition, move focus to the new level's heading; `Esc` goes
   back (already exists); the "full data" drawer traps focus and returns it when closed.
5. Touch targets ≥ 44×44 px on phones.

## Tests
You may update `app/e2e/**` to match the new UI: remove `test.fail`/known-failure entries that
your change fixes, adapt selectors, and add viewports you are asked to check. Never weaken a
check to hide a real problem.

## Acceptance criteria
- [ ] The full journey can be done with the keyboard only (describe the exact key sequence in
      the report).
- [ ] Every control has an accessible name, headings are in order, landmarks exist. Wanted
      additions to the e2e suite (outside this ticket's files) go under Handoff.
- [ ] Text size and high contrast work on every level without overlaps. All checks pass.
