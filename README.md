# Ciberpiso

Decision-support tool to explore **crop rotations** using Earth observation data and
local context. Project for the **2026 Space Apps Challenge**, challenge
[*Field Shift: Adapting Farms with Space Data*](https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/).

> Status: calculator with real data for 60 candidate plots in Málaga and a frontend MVP
> in [`app/`](app/README.md). The app already shows the 26 Antequera candidates with the
> four computed rotations; the English translation and the offline test are still pending.

## The challenge

Farmers need to choose rotations that protect the soil, conserve water and withstand
extreme events, but every crop involves trade-offs: one improves the soil and uses too
much water, another opens a market but does not fit in the sowing window.

The challenge asks for a tool that combines Earth observations with soils, crops and
the farmer's priorities to compare rotations. It does not ask to predict yield or to
replace an agronomist.

### Challenge sheet

| Field | Value |
| --- | --- |
| Event | 2026 Space Apps Challenge |
| Difficulty | Advanced + Intermediate |
| Subjects | Arts & Multimedia, Earth Science, Software |
| Tabs | Details, Resources, Teams |
| Video | 6 s teaser, no technical content |
| Dates / rubric | Not published on the challenge page |

### Hard requirements

1. Compare **at least 3 rotation strategies**, including the current one.
2. For each one, explain: why it is suggested, what evidence backs it, what benefits
   it offers, **where data is missing** and **what risks need local review**.
3. Be a **support** tool, not a substitute for the farmer's judgement.
4. Be interpretable by users without geospatial training and let them enter their own
   priorities and constraints (water, machinery, market).

## Current approach

- **Use case:** rainfed farming in the Campiña de Antequera (Málaga), with 60 candidate
  plots in the province and 26 in Antequera. Current rotation R0 wheat–sunflower and
  three alternatives: R1 +chickpea, R2 +vetch, R3 +fallow.
- **Data:** POWER (climate), MODIS MOD13Q1 (NDVI), SoilGrids (soil), Eurostat
  (wheat, sunflower and chickpea prices), MAPA (grain vetch) and SIGPAC (plots).
- **Output:** `data/processed/indicators.json` with the four rotations, evidence,
  gaps and risks; the app loads the 26 Antequera candidates.
- **Model:** weighted, explainable rules, not a black box. The water score is
  validated against NDVI (AUC 0.723) and confidence drops when data is missing.

## Documentation

| Document | What it contains |
| --- | --- |
| [Action plan](docs/plan-de-accion.md) | Current direction: Antequera farm, four rotations and first step. |
| [Scraped sources](docs/fuentes-scraping.md) | Málaga data pipeline: sources from `resources.md`, CSV, SQLite and gaps. |
| [Data](data/README.md) | Two copies, `data/malaga/` and `data/andalucia/`, with their CSVs, SQLite database, schema and queries. |
| [Step-by-step guide](docs/guia-paso-a-paso.md) | 48 h plan, phases, deliverables and "done" criteria. |
| [Scope](docs/alcance.md) | Sheet to fix AOI, profile, decision and rotations. |
| [Example rotations](docs/rotaciones.md) | Four strategies with evidence, benefits, gaps and risks. |
| [Data sources](docs/fuentes-de-datos.md) | What each source offers, resolution, access, use and limits. |
| [Data access](docs/acceso-datos.md) | Verified API examples, authentication, caching and harmonisation. |
| [Architecture](docs/arquitectura.md) | Stack, data contracts, scoring model and deployment. |
| [Validation](docs/validacion.md) | Log of checks, limits and what is still to be validated. |
| [Evaluation checklist](docs/checklist-evaluacion.md) | How to demonstrate the requirements and what to avoid in the demo. |
| [resources.json](resources.json) | Machine-readable inventory. |

> `resources.md` and `tools_available.md` are the team's quick lists. The complete,
> verified reference is in `docs/fuentes-de-datos.md` and `resources.json`.
> (The documents in `docs/` keep their original Spanish file names.)

## Quick start

1. Read the guide and fix the scope: one county, one farm profile, three rotations.
2. Check access to the sources that need no credentials with the commands in
   `docs/acceso-datos.md`.
3. Download and cache the AOI. Do not query live APIs during the demo.
4. Compute the indicators and store them as versioned JSON/GeoJSON.
5. Build the UI on that data; the scoring engine must be a pure function.
6. Rehearse a 3-minute demo without a network connection.

## Recommended stack

- **Pipeline:** Python 3.11 + `requests` + `geopandas`/`rioxarray` (offline only).
- **App:** Next.js + TypeScript + MapLibre GL JS.
- **Data:** precomputed JSON and GeoJSON; no backend in the demo.
- **Quick alternative:** Streamlit if the team is Python-only and prioritises the model
  over visual polish.

## What it is not

- It is not an agronomic prescription per plot.
- It does not replace the farmer, the agronomist or field data.
- It does not promise plot-level resolution with SMAP (9 km) or POWER (0.5°).
- It is not a real-time satellite dashboard.

## Risks and gaps

- **GRACE** is cited in the challenge text without its own link; the specific product
  (mascons) must be located and documented. **GEDI** does have a link in Resources.
- **CDL and SSURGO** only cover the US; for a global case, switch to GAEZ and to the
  FAO harmonised soil database.
- **OpenET** only covers the western US.
- **SMAP** is 9 km with gaps; it is not suitable for plot scale.
- **GIBS** has SMAP/IMERG layers, but they are visualisation PNGs, not data.
- **Market:** QuickStats and AMS require a key; if unavailable, use a curated CSV with
  average prices and a cited source.

## Sources and credits

- Official challenge: [Space Apps Challenge 2026](https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/).
- Data: USDA, USGS, ECMWF/Copernicus and ESA, plus the space agency's open data. Each
  document states the source, the verification date and the licence or terms of use.
- The challenge organisers do not endorse non-federal entities; respect each site's
  terms.

## Status

- [x] Research of the challenge text and of the sources.
- [x] Verification of endpoints without credentials.
- [x] Guide, architecture and checklist.
- [x] Action plan with the new Antequera case.
- [ ] Use case and AOI data.
- [ ] Pipeline and app.
- [ ] Validation with an agronomist or extension officer.
