# Ciberpiso · Crop Rotation Explorer (frontend MVP)

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
- "Datos completos" opens the Conditions tab (`components/ConditionsTab.tsx`) for the farm.
- `three` is loaded on demand in its own chunk; the 3D view only renders while something moves and lowers its resolution if the first frames are slow.
- `?director` shows a small panel to replay transitions at 0.5× or 0.25×.

The Andalucía level needs the provinces and per-municipality colours, built from the CSVs:

```bash
python -m pipeline.export_app_andalucia   # public/data/provincias_andalucia.geojson, municipios_29_stats.json
```

`MapView`, `MapScreen`, `FincaPicker`, `Header`, `SearchBox` and `Dashboard` are no longer mounted; their logic (municipality loading, `apt` rules, farm data) is reused by the explorer.

## Architecture (10 lines)

1. `src/App.tsx` mounts the explorer (`src/explorer/`) and the About modal; the components below are the previous map-and-dashboard interface.
2. `src/store.ts` (Zustand) holds all state: selected farms, step, terrain, climate, priorities, constraints, GIBS layers.
3. `components/MapView.tsx` owns MapLibre: Esri basemap, farm and selection layers, GIBS overlays, 3D terrain and the fly-to.
4. `components/FincaPicker.tsx` drives the map funnel (Málaga → municipality → farms) and the selection; `lib/fincas.ts` loads each municipality on demand; `lib/pulse.ts` animates selections.
5. `lib/terrain.ts` adds the Terrarium DEM + hillshade and falls back to a flat map on errors; slope comes from the farms' project data.
6. `lib/power.ts` fetches POWER daily data, caches it in localStorage and falls back to a bundled sample.
7. `lib/climate.ts` derives monthly climatology, frost days, rain variability, Turc water balance and trends.
8. `lib/gibs.ts` lists the GIBS layers verified in GetCapabilities and builds the WMTS tile URLs.
9. `lib/scoring.ts` is the transparent rule engine (0–100 per priority, a reason and an uncertainty level each); `lib/rotations.ts` builds strategies A/B/C and their texts.
10. `lib/indicators.ts` loads the precomputed project results for 26 Antequera candidates; `components/RealRotations.tsx` shows R0–R3 with their evidence, gaps and local review notes. The gold-outlined farms use this path.
11. All UI text lives in `src/i18n/en.ts`; add `es.ts` with the same shape to translate. Project narrative inside the precomputed JSON is still Spanish.

## Real vs demo data

| Data | Status | Source |
| --- | --- | --- |
| Daily temperature, min temperature, rain, radiation, humidity (2015 → yesterday) | **Real** | POWER daily point API (AG community) |
| Climatology, frost days, rain variability, water balance, trends | **Real (derived)** | Computed in the browser from POWER; ET uses the Turc formula and is labelled approximate |
| MODIS Terra NDVI 8-day, GPM IMERG precipitation rate, SMAP L4 surface soil moisture | **Real imagery** | GIBS WMTS (EPSG:3857), names verified in GetCapabilities |
| Farm boundaries (363,401 farms in the 103 municipalities of Málaga) | **Real** | SIGPAC parcels (FEGA, CC BY 4.0) joined to `data/malaga/csv/29_malaga/fincas.csv`; built with `pipeline/export_app_fincas.py` |
| Farm slope, altitude, land cover | **Real** | Project dataset (`data/malaga/csv/29_malaga/fincas.csv`: SRTM-derived DEM, ESA WorldCover) |
| Precomputed rotation results for 26 Antequera candidates | **Real** | `data/processed/indicators.json`, filtered by `pipeline/export_app_indicators.py` into `public/data/indicators_antequera.json` |
| 3D terrain | **Real** | Mapzen Terrarium tiles on AWS Open Data |
| Basemap, place search | **Real** | Esri World Imagery, OpenStreetMap Nominatim |
| Soil per farm (texture, organic carbon, pH, N, CEC, available water) | **Real** | ISRIC SoilGrids 2.0 in the project dataset → `public/data/detalle/` |
| Seasonal vegetation, NDVI series and observed rotation per farm | **Real** | MODIS NDVI in the project dataset → `public/data/detalle/` |
| Climate and root-zone soil moisture per season (2002–2025) | **Real** | POWER cell summaries in the project dataset → `public/data/comun_29.json` |
| Crop prices | **Real** | Eurostat apri_ap_crpouta and MAPA (vetch) → `public/data/comun_29.json` |
| Heat stress index per month | Derived | From POWER temperature and the approximate water balance |
| Income score | Proxy | 70 % market ease (crop catalog) + 30 % latest national price, the same formula as `pipeline/calculator.py`; no yields or costs |
| Crop catalog | Hand-made reference | `src/data/crops.json` |

When a farm has no SoilGrids data, typical soil values are used; the score says so, shows a dashed badge and its
uncertainty goes up. If POWER is unreachable, the app uses `src/data/sample-power.json` (real POWER data for
Antequera, Spain) and shows a warning.

## Farm data

When you analyse one or more farms, the app downloads the project data of their municipality
(`public/data/detalle/{municipio_key}.json.gz`, 20 MB in total) and the province file
(`public/data/comun_29.json`, 113 kB). The Conditions tab shows it per farm, Priorities is prefilled with the
SoilGrids texture and the crop the satellite saw last season, and the rotation scores use the real soil and
prices. To rebuild the files from `data/malaga/csv/`:

```bash
python -m pipeline.export_app_detalle --provincia 29
```

## Farm map

The map covers the province of Málaga. It opens on the 103 municipalities
(`public/data/municipios_29.geojson`, 0.4 MB); clicking one, searching a place or zooming in loads only
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

## Precomputed project results

Gold-outlined farms have results from the project pipeline. The button **Open a demo farm with
project data** selects the first one. To regenerate the file after changing the calculator:

```bash
python3 pipeline/calculator.py
python3 pipeline/export_app_indicators.py
```

The app loads `public/data/indicators_antequera.json` and needs no backend or live API for
that path. If the file is missing, the interactive engine still works and the project-data
button does not appear.

## Next steps

- SMAP L3/L4 soil moisture and ECOSTRESS ET/ESI time series via Earthdata (needs Earthdata Login, so a small proxy).
- Yields and costs per crop, so the income score becomes a margin instead of a price proxy.
- The declared crop from SIGPAC (cultivo_declarado) to check the crop estimated from NDVI.
- English translation of the precomputed project narrative (the UI labels are already English; the calculator text is Spanish).
- Spanish translation (`src/i18n/es.ts`) and validation of scoring rules with local agronomists.

## Acknowledgements

Climate data: POWER Project, Langley Research Center (LaRC). Imagery: Global Imagery Browse Services (GIBS),
part of the Earth Science Data and Information System (ESDIS).
