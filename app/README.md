# Ciberpiso · Crop Rotation Explorer (frontend MVP)

A decision-support web app that helps farmers explore crop-rotation strategies using NASA Earth
observations. It supports farmer judgment; it does not replace it.

## Run

```bash
cd app
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build in dist/
```

No backend and no API keys: every request goes straight from the browser to public services.

## Architecture (10 lines)

1. `src/App.tsx` stacks the full-screen map, the header, the map screen or dashboard, the disclaimer and the About modal.
2. `src/store.ts` (Zustand) holds all state: field, step, terrain, climate, priorities, constraints, GIBS layers.
3. `components/MapView.tsx` owns MapLibre: Esri basemap, field layers, GIBS overlays, 3D terrain and the fly-to.
4. `components/DrawControls.tsx` uses Terra Draw for polygons; a single click makes a ~500 m square.
5. `lib/terrain.ts` adds the Terrarium DEM + hillshade, falls back to a flat map on errors, and estimates slope.
6. `lib/power.ts` fetches NASA POWER daily data, caches it in localStorage and falls back to a bundled sample.
7. `lib/climate.ts` derives monthly climatology, frost days, rain variability, Turc water balance and trends.
8. `lib/gibs.ts` lists the GIBS layers verified in GetCapabilities and builds the WMTS tile URLs.
9. `lib/scoring.ts` is the transparent rule engine (0–100 per priority, a reason and an uncertainty level each); `lib/rotations.ts` builds strategies A/B/C and their texts.
10. All UI text lives in `src/i18n/en.ts`; add `es.ts` with the same shape to translate.

## Real vs demo data

| Data | Status | Source |
| --- | --- | --- |
| Daily temperature, min temperature, rain, radiation, humidity (2015 → yesterday) | **Real** | NASA POWER daily point API (AG community) |
| Climatology, frost days, rain variability, water balance, trends | **Real (derived)** | Computed in the browser from POWER; ET uses the Turc formula and is labelled approximate |
| MODIS Terra NDVI 8-day, GPM IMERG precipitation rate, SMAP L4 surface soil moisture | **Real imagery** | NASA GIBS WMTS (EPSG:3857), names verified in GetCapabilities |
| Terrain, slope | **Real** | Mapzen Terrarium tiles on AWS Open Data |
| Basemap, place search | **Real** | Esri World Imagery, OpenStreetMap Nominatim |
| Soil properties (texture, organic matter, drainage) | Demo | `src/data/mock/soil.ts` |
| SMAP soil-moisture anomaly series, ECOSTRESS heat stress | Demo | `src/data/mock/smap.ts`, `src/data/mock/ecostress.ts` |
| Market suitability | Demo | `src/data/mock/market.ts` |
| Crop catalog | Hand-made reference | `src/data/crops.json` |

Demo data shows a dashed **demo data** badge wherever it appears, and it raises the uncertainty level of the scores
that use it. If POWER is unreachable, the app uses `src/data/sample-power.json` (real POWER data for
Antequera, Spain) and shows a warning.

## Next steps

- SMAP L3/L4 soil moisture and ECOSTRESS ET/ESI time series via NASA Earthdata (needs Earthdata Login, so a small proxy).
- SSURGO soil properties via the USDA Soil Data Access API (US); SoilGrids or national maps elsewhere.
- USDA Cropland Data Layer (CDL) to detect the current crop and past rotations (US).
- OpenET field-scale evapotranspiration (western US) to replace the approximate Turc estimate.
- Spanish translation (`src/i18n/es.ts`) and validation of scoring rules with local agronomists.

## Acknowledgements

These data were obtained from the NASA Langley Research Center (LaRC) POWER Project funded through the NASA
Earth Science/Applied Science Program. We acknowledge the use of imagery provided by services from NASA's
Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS).
NASA does not endorse this project.
