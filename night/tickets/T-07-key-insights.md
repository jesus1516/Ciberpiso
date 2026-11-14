---
id: T-07
title: Farm view - surface what really matters for this farm
model: opus
effort: high
depends: ["T-06"]
files: ["app/src/explorer/**"]
maxAttempts: 2
timeoutMin: 150
---
## Goal
The accessibility team asked that, when entering a farm, the truly relevant information is
bigger and immediate: what is the main risk or opportunity of THIS farm, without reading four
cards and a timeline.

## Task
1. Add `app/src/explorer/insights.ts`: a pure, unit-testable function that takes the farm data
   already loaded (`scores` R0–R3 from `lib/calculator.ts`, `climate`, `soil`, slope, `apt`,
   observed seasons) and returns 1–3 ranked insights, each with a severity
   (critical / warning / good), a short headline (≤ 60 characters) and a one-sentence
   explanation with the number behind it. Examples (use real thresholds from the calculator):
   - "High heat risk in May–June" (heat days), "Severe water deficit (823 mm/yr)",
   - "Steep slope: erosion risk" (slope ≥ 8–15 %), "Soil with little available water",
   - "Best option: R1 (+2.8 points over current)" — the recommended rotation for the profile,
   - "Looks like a permanent crop: rotations are indicative" (apt / land cover / seasons).
   Document the rules in a comment table at the top of the file.
2. Show the insights at the top of the farm column, larger than everything else, with the most
   severe first; the card behind the top insight is visually emphasised, the others recede.
   The headline must also be announced to screen readers when the farm view opens
   (`aria-live="polite"`).
3. Add a short "Recommendation" line under the rotation selector: the best rotation for the
   chosen priority and why, in one sentence.
4. Unit tests for `insights.ts` (Vitest, `insights.test.ts`) if the test runner from T-04 exists.

## Acceptance criteria
- [ ] Each farm shows 1–3 ranked insights, consistent with its numbers (check Antequera
      2900059683, Ronda 2900263939 and one farm with `apt` set).
- [ ] The most relevant item is the most prominent element of the column.
- [ ] Rules documented and tested; all checks pass.
