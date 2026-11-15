# AgroSpace · the web app

A decision-support web app that helps farmers explore crop-rotation strategies using Earth
observations. It supports farmer judgment; it does not replace it.

## Run

```bash
cd app
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build in dist/
```

No backend and no API keys: every request goes straight from the browser to public services.

## Explorer (main interface)

`src/App.tsx` mounts `src/explorer/`, the guided funnel **Andalucía → Málaga → municipality → farm** with its transitions:

| Step | Transition | Code |
| --- | --- | --- |
| Andalucía → Málaga | The camera dives through a cloud bank (layered fBm shader); layers swap while the screen is covered | `explorer/clouds.ts`, `controller.ts` |
| Málaga → any municipality | The outline is traced, a low mist passes along the edges and the municipality's farms appear | `controller.ts` |
| Municipality → farm | The map flies to the farm top-down and hands a snapshot of itself to the 3D terrain, which lifts it | `controller.ts`, `explorer/diorama.ts` |

- Every municipality and farm of Málaga can be opened. Built-up, water and public-land farms cannot be selected; mountain, steep and rocky farms open with a warning (same `apt` rule as the farm map).
- The 3D block uses real terrain (Terrarium) and imagery (Esri), the farm boundary, a soil profile from SoilGrids, trees where WorldCover and the imagery agree, and the crop seen by MODIS each season (2020–2025) followed by the chosen rotation (2026–2031).
- R0–R3 scores are computed in the browser for any farm by `lib/calculator.ts`, a port of `calculate_scores` in `pipeline/calculator.py`. `node scripts/check-calculator.ts` checks it against the 26 precomputed Antequera candidates (1,144 values, 0 differences).
- "Full data" opens the Conditions tab (`components/ConditionsTab.tsx`) for the farm.
- `three` is loaded on demand in its own chunk; the 3D view only renders while something moves and lowers its resolution if the first frames are slow.
- `?director` shows a small panel to replay transitions at 0.5× or 0.25×.
- The search at the top centre (`explorer/SigpacSearch.tsx`, parser in `explorer/sigpac.ts`) goes from any level
  straight to a municipality or a farm. It accepts the SIGPAC reference as a farmer has it in the CAP declaration:
  `Antequera 100 1`, `29:15:100:1`, `29:15:0:0:100:1`, `15:100:1`, or just `100 1` for the municipality on screen
  (any of space `:` `/` `-` `.` `,` separates the numbers); a name alone lists the matching municipalities. In
  Málaga the aggregate and zone are always 0 and (municipality, polygon, parcel) is unique, so a reference finds
  one farm. Built-up, water and public-land farms are shown on the map with the usual warning instead of opening.

The Andalucía level needs the provinces and per-municipality colours, built from the CSVs:

```bash
python -m pipeline.export_app_andalucia   # public/data/provincias_andalucia.geojson, municipios_29_stats.json
```

`MapView`, `MapScreen`, `FarmPicker`, `Header`, `SearchBox`, `LayersTab` and `RealRotations` are no longer mounted; their logic (municipality loading, `apt` rules, farm data) is reused by the explorer. The old dashboard and its A/B/C rule engine were removed: see [Rotation engine](#rotation-engine).

## Architecture

1. `src/main.tsx` → `src/App.tsx` mounts the explorer (`src/explorer/`) and the Sources dialog (`components/AboutModal.tsx`).
2. `explorer/controller.ts` drives MapLibre and the transitions between the four levels; `explorer/state.ts` (Zustand) holds the explorer state.
3. `explorer/diorama.ts` (three.js) draws the farm as a 3D block of real terrain with trees and numbered markers; `explorer/clouds.ts` draws the cloud transitions. Both load in a separate chunk, never when the 3D is off.
4. `explorer/FarmView.tsx` is the farm column: ranked insights (`insights.ts`), indicator cards, the timeline, rotations R0–R3 and the priority; `FullDataPanel.tsx` is the "Full data" drawer and `FarmTable.tsx` the data table.
5. `explorer/AccessList.tsx`, `SettingsMenu.tsx`, `settings.ts` and `useFocusTrap.ts` are the accessibility layer: keyboard lists, text size, contrast, reduced motion, 3D off.
6. `explorer/SigpacSearch.tsx` + `sigpac.ts`: search by SIGPAC reference or municipality name.
7. `lib/farms.ts` + `farms.worker.ts` and `lib/detail.ts` + `detail.worker.ts` load and parse the municipality data in Web Workers; `src/store.ts` keeps the farm data and climate the drawer shows.
8. `lib/power.ts` fetches POWER daily data (cached, with a bundled sample if offline); `lib/climate.ts` derives the monthly climatology and trends.
9. `lib/calculator.ts` is the only rotation engine (R0–R3 for any farm); its parameters are `src/data/engine.json`, exported from the pipeline. See [Rotation engine](#rotation-engine).
10. `explorer/tokens.ts`, `explorer.css` and `access.css` hold the colour tokens and styles; all UI text is in `src/i18n/en.ts`.
11. `src/components/` still holds the previous map-and-dashboard interface (`MapView`, `FarmPicker`, …); it is not mounted.

## Real vs demo data

| Data | Status | Source |
| --- | --- | --- |
| Daily temperature, min temperature, rain, radiation, humidity (2015 → yesterday) | **Real** | POWER daily point API (AG community) |
| Climatology, frost days, rain variability, water balance, trends | **Real (derived)** | Computed in the browser from POWER; ET uses the Turc formula and is labelled approximate |
| MODIS Terra NDVI 8-day, GPM IMERG precipitation rate, SMAP L4 surface soil moisture | **Real imagery** (previous map interface, not mounted) | GIBS WMTS (EPSG:3857), names verified in GetCapabilities |
| Farm boundaries (363,401 farms in the 103 municipalities of Málaga) | **Real** | SIGPAC parcels (FEGA, CC BY 4.0) joined to `data/malaga/csv/29_malaga/fincas.csv`; built with `pipeline/export_app_fincas.py` |
| Farm slope, altitude, land cover | **Real** | Project dataset (`data/malaga/csv/29_malaga/fincas.csv`: SRTM-derived DEM, ESA WorldCover) |
| Precomputed rotation results for 26 Antequera candidates | **Real** | `data/processed/indicators.json`, filtered by `pipeline/export_app_indicators.py` into `public/data/indicators_antequera.json` |
| 3D terrain | **Real** | Mapzen Terrarium tiles on AWS Open Data |
| Basemap | **Real** | Esri World Imagery |
| Soil per farm (texture, organic carbon, pH, N, CEC, available water) | **Real** | ISRIC SoilGrids 2.0 in the project dataset → `public/data/detalle/` |
| Seasonal vegetation, NDVI series and observed rotation per farm | **Real** | MODIS NDVI in the project dataset → `public/data/detalle/` |
| Climate and root-zone soil moisture per season (2002–2025) | **Real** | POWER cell summaries in the project dataset → `public/data/comun_29.json` |
| Crop prices | **Real** | Eurostat apri_ap_crpouta and MAPA (vetch) → `public/data/comun_29.json` |
| Market score | Proxy | 70 % market ease (`data/crops.csv`) + 30 % latest national price, in `pipeline/calculator.py` and its port `lib/calculator.ts`; no yields or costs |
| Crop parameters (1–5 water demand, cover months, market ease…) | Hand-made reference | `data/crops.csv`, exported to `src/data/engine.json` |

When a farm has no SoilGrids data, typical soil values are used; the score says so, shows a dashed badge and its
uncertainty goes up. If POWER is unreachable, the app uses `src/data/sample-power.json` (real POWER data for
Antequera, Spain) and shows a warning.

## Farm data

When you analyse one or more farms, the app downloads the project data of their municipality
(`public/data/detalle/{municipio_key}.json.gz`, 20 MB in total) and the province file
(`public/data/comun_29.json`, 113 kB). "Full data" shows it per farm, and the rotation scores use its climate, soil and prices. To rebuild the files from `data/malaga/csv/`:

```bash
python -m pipeline.export_app_detalle --provincia 29
```

## Farm map

The map covers the province of Málaga. It opens on the 103 municipalities
(`public/data/municipios_29.geojson`, 0.4 MB); clicking or searching one loads only
that municipality's farms (`public/data/fincas/{municipio_key}.geojson.gz`, 35 MB in total, 2.1 MB at
most). The browser decompresses the files itself, so any static host works.

Farms that do not look like cropland are marked on the map (rule in `aptitud()` in
`pipeline/export_app_fincas.py`, using ESA WorldCover, SRTM-derived DEM slope and SIGPAC parcel numbers):

| Class | Rule | On the map |
| --- | --- | --- |
| Built-up, water | ≥ 50 % of the farm, or the dominant cover (built-up ≥ 30 %) | Grey hatch; cannot be selected |
| Public land | SIGPAC parcel 9000 or above (roads, paths, streams) | Grey hatch; cannot be selected |
| Bare rock, mountain, very steep | ≥ 50 % bare soil; ≥ 50 % shrubland or ≥ 80 % trees + shrubland on ≥ 30 % slope; slope ≥ 30 % | Dimmed; can be selected with a warning |

Trees on gentle slopes are not marked, because in Málaga they are usually olive or almond groves.

To rebuild them, download the SIGPAC GeoPackage with `pipeline.sigpac` and run, from the repo root:

```bash
python -m pipeline.export_app_fincas --provincia 29
```

`public/data/fincas_antequera.geojson` is no longer loaded by the app; it is kept because
`pipeline/export_app_indicators.py` and its test still read it.

## Rotation engine

There is one engine: `calculate_scores` in `pipeline/calculator.py`. The app runs its TypeScript port,
`src/lib/calculator.ts`, in the browser for any farm of Málaga, with the farm's climate cell, soil and prices
from `public/data/`. The heat, frost, insight and recommendation texts of the farm view all read its scores.

The port does not copy numbers by hand. Crop parameters (`data/crops.csv`), the water scale
(`data/calibration.json`) and the rotations and profile weights (`ROTATIONS`, `PROFILES` in
`pipeline/calculator.py`) are exported to `src/data/engine.json`. After changing any of them:

```bash
python3 -m pipeline.export_app_engine   # rewrites app/src/data/engine.json
node app/scripts/check-calculator.ts    # the app must still give the pipeline's scores
```

`tests/test_export_app_engine.py` fails while `engine.json` is out of date. `check-calculator.ts` compares the
app with the pipeline output for the 26 Antequera candidates (`public/data/indicators_antequera.json`,
1,144 values, 0 differences). To regenerate that file after changing the calculator:

```bash
python3 pipeline/calculator.py
python3 pipeline/export_app_indicators.py
```

If you change the formulas in `calculator.py` (not only its parameters), change `lib/calculator.ts` the same
way; the check shows any difference.

## Next steps

- SMAP L3/L4 soil moisture and ECOSTRESS ET/ESI time series via Earthdata (needs Earthdata Login, so a small proxy).
- Yields and costs per crop, so the income score becomes a margin instead of a price proxy.
- The declared crop from SIGPAC (cultivo_declarado) to check the crop estimated from NDVI.
- English translation of the narrative inside `indicators_antequera.json` (Spanish; the explorer does not show it, only the old `RealRotations` panel did).
- Spanish translation (`src/i18n/es.ts`) and validation of the calculator rules with local agronomists.

## Acknowledgements

Climate data: POWER Project, Langley Research Center (LaRC). Imagery: Global Imagery Browse Services (GIBS),
part of the Earth Science Data and Information System (ESDIS).
