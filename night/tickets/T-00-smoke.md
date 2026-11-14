---
id: T-00
title: Smoke test - English page metadata
model: sonnet
effort: medium
depends: []
files: ["app/index.html"]
maxAttempts: 2
timeoutMin: 30
---
## Goal
A tiny, real change that proves the night shift pipeline works end to end.

## Task
`app/index.html` is in Spanish. Make its metadata English:
- `<html lang="es">` → `lang="en"`.
- `<title>` → `Ciberpiso · From territory to farm`.
- `<meta name="description">` → an English sentence of similar meaning (crop rotations in
  Málaga with satellite, climate, SIGPAC and SoilGrids data). Do not mention NASA.

## Acceptance criteria
- [ ] Only `app/index.html` (and your report) changed.
- [ ] `lang`, `<title>` and `description` are English; nothing else in the file changed.
- [ ] All checks pass.
