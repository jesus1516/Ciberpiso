---
id: T-11
title: Viability report - extending the app to all of Andalucia
model: sonnet
effort: high
depends: []
files: ["docs/andalucia-viability.md"]
maxAttempts: 2
timeoutMin: 90
---
## Goal
Decide, with numbers, whether and how to extend the farm-level explorer from Málaga to the 8
provinces of Andalucía. Report only: do not implement anything.

## Task
Write `docs/andalucia-viability.md` (English) covering:
1. Data available today: rows and size per province in the full CSVs at the read-only data
   directory given in your instructions (`data/andalucia/csv/<prov>/*.csv`, read them there),
   what the app needs per municipality (`app/public/data/fincas/*.geojson.gz`,
   `app/public/data/detalle/*.json.gz`, `comun_29.json`) and how they are produced
   (`pipeline/export_app_fincas.py`, `pipeline/export_app_detalle.py`, `pipeline/sigpac.py`).
2. Estimated output size for all Andalucía (extrapolate from Málaga: farms per province ×
   bytes per farm), where to host it (the git repo, Git LFS, GitHub Releases, a static bucket)
   and the trade-offs; GitHub's 100 MB file limit and repository size guidance.
3. Processing time and disk needed (SIGPAC GeoPackage downloads per province, export runtime
   extrapolated from Málaga), and machine requirements.
4. App changes needed (province level selection, climate cells per province, the calculator
   already works anywhere, performance with more data) with an effort estimate in hours.
5. Risks and a recommended step-by-step plan (e.g. one extra province first).

## Acceptance criteria
- [ ] Every number has its source or calculation shown.
- [ ] Clear recommendation and estimate. Only the report file changed.
