# Scraped sources: Spain (Málaga)

> Living record of the sources used by the `pipeline/` pipeline. **Team rule:
> all farm data comes from sources in [`resources.md`](../resources.md).**
>
> Last updated: 14 November 2026. Scope: **province of Málaga (29)**.
> Antequera is SIGPAC municipality **15** (`municipio_key = 29015`).

## Summary

| Data per farm | Source | In `resources.md`? | CSV table |
| --- | --- | --- | --- |
| Daily climate 2001–2025 → indicators per season | **POWER** | ✅ #6–7 | `clima_anual`, `dim_celda_power` |
| Soil moisture (surface, root zone, profile) | **POWER** (MERRA-2) | ✅ #6–7 | `suelo_humedad_anual` |
| Altitude and slope | **SRTM** (NASADEM version) via Planetary Computer | ✅ #28 (and SRTM, #3–4) | `fincas` |
| Soil texture, carbon, pH and available water | **ISRIC SoilGrids 2.0** | ⚠️ approved exception | `suelo_fincas` |
| Farm-gate agricultural prices in Spain, annual 2000–2024 | **Eurostat** `apri_ap_crpouta` | ⚠️ approved exception | `precios_anuales`, `dim_producto_precio` |
| Land cover (% crop, trees, grass…) | **ESA WorldCover 2021** via Planetary Computer | ✅ #28 | `fincas` |
| Vegetation and estimated crop per season | **MODIS MOD13Q1** (LP DAAC) via Planetary Computer | ✅ #4, #28 | `fenologia_fincas`, `ndvi_fincas`, `fincas` |
| Where each farm is (identifier and polygon) | SIGPAC recintos 2026 (FEGA) | ❌ (see note) | `fincas`, `recintos`, `dim_municipio` |

**Note on SIGPAC.** No source in `resources.md` delimits farms in Spain, so SIGPAC is
used **only as a skeleton**: plot/enclosure code, municipality and polygon. **No
thematic SIGPAC attribute is used** (use, slope, altitude, irrigation or declared
crop). Everything that describes the farm comes from the sources in the table above.

**Note on SoilGrids.** The team works with **SoilGrids + SRTM**. SoilGrids is not in
`resources.md`, but the action plan already fixed it as the substitute for SSURGO
(which only covers the US), so it enters as the **single explicit exception**. SRTM is
in the list; its reprocessed version (NASADEM) is used, with the same 2000 radar data,
filled voids and better calibration.

## 1. Review of `resources.md`, link by link

| # | Link | Source | Covers Spain? | Use in the pipeline | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | earthdata…/smap | SMAP | Yes (9 km) | Requires Earthdata Login; soil moisture comes from POWER | 🔑 |
| 2 | gpm.nasa.gov/data | GPM / IMERG | Yes (0.1°) | Rain comes from POWER; IMERG is also in Planetary Computer (`gpm-imerg-hhr`) | ⏸️ |
| 3 | earthexplorer.usgs.gov | Landsat / SRTM | Yes | Relief with NASADEM (reprocessed SRTM) via #28 | ✅ (via #28) |
| 4 | earthdata…/lp-daac | MODIS / VIIRS (LP DAAC) | Yes (250 m) | **MOD13Q1 NDVI** via Planetary Computer | ✅ |
| 5 | search.earthdata…VIIRS | VIIRS | Yes | Not needed (MODIS covers the series) | ⏸️ |
| 6–7 | power.larc.nasa.gov | **POWER** | Yes (0.5°×0.625°) | Climate and soil moisture per cell | ✅ |
| 8 | ecostress.jpl.nasa.gov | ECOSTRESS | Yes (~70 m) | Requires Earthdata/AppEEARS | 🔑 |
| 9–11 | nal.usda.gov/…agdatacommons | Ag Data Commons | No | — | ⛔ |
| 12 | prism.oregonstate.edu | PRISM | No | — | ⛔ |
| 13 | nrcs.usda.gov/…/soils | SSURGO / NRCS | No | Substitute: **SoilGrids** (approved exception) | ⛔ |
| 14 | naip-usdaonline… | NAIP | No | — | ⛔ |
| 15 | usgs.gov/…/nlcd | NLCD | No | Cover with WorldCover (#28) | ⛔ |
| 16–17 | earthdata.nasa.gov | Earthdata portal | — | Login and catalogue | ➖ |
| 18 | cocorahs.org | CoCoRaHS | No | — | ⛔ |
| 19 | waterdata.usgs.gov | NWIS | No | — | ⛔ |
| 20 | ams.usda.gov/market-news | AMS Market News | No (US) | Substitute: **Eurostat** (approved exception) | ⛔ |
| 21 | quickstats.nass.usda.gov | NASS QuickStats | No (US) | No yields for Spain | ⛔ |
| 22 | etdata.org | OpenET | No | ET0 computed with POWER | ⛔ |
| 23 | landfire.gov | LANDFIRE | No | — | ⛔ |
| 24 | gedi.umd.edu | GEDI | Yes | Requires Earthdata; of little use on cropland | 🔑 |
| 25 | earthdata…/lp-daac | (repeat of #4) | — | — | — |
| 26 | spaceapps.earth | Event website | — | — | ➖ |
| 27 | meteomatics.com | Meteomatics | Yes | API with an account; not needed | ⏸️ |
| 28 | planetarycomputer.microsoft.com | **Planetary Computer** | Yes | NASADEM, WorldCover, MODIS (anonymous STAC) | ✅ |

Legend: ✅ used · 🔑 requires credentials we do not have · ⏸️ available, not needed ·
⛔ US only · ➖ not a dataset.

## 2. Detail per source

### 2.1 POWER (`pipeline/power.py`)

- **Endpoint:** `https://power.larc.nasa.gov/api/temporal/daily/point`, `community=AG`,
  no key. Daily series **2001-01-01 → 2025-12-31**.
- **Parameters:** `PRECTOTCORR, T2M, T2M_MAX, T2M_MIN, TOA_SW_DWN, ALLSKY_SFC_SW_DWN,
  GWETTOP, GWETROOT, GWETPROF, RH2M, WS2M`.
- **Grid:** MERRA-2, 0.5° lat × 0.625° lon. It is requested once per cell (10 cells in
  Málaga), not per farm. `celda_power = round((lat+90)/0.5)*1000 + round((lon+180)/0.625)`.
- **Indicators per season** (October of the previous year to September): total rain and
  October-to-May rain, Hargreaves-Samani ET0 (Ra = `TOA_SW_DWN` × 0.408), water
  deficit, days with Tmax ≥ 32 °C in May–June (grain filling) and ≥ 35 °C in
  July–August (sunflower), total and late frosts, mean soil moisture, spring and
  sowing soil moisture and its anomaly.
- **Verified gotchas:**
  - In the `climatology` and `monthly` series, `T2M_MAX`/`T2M_MIN` are **extremes**,
    not means. That is why the daily series is used.
  - MERRA-2 `GWETROOT` in Málaga does not drop below ~0.46: a fixed "dry soil"
    threshold is useless. The **anomaly** with respect to the cell mean is used.
  - Coastal cells (lat 36.5) mix sea and land: low ET0 and heat.
- **Quick validation:** Antequera cell (37.0, −4.375): 453 mm/year on average,
  331 mm in a dry year (p20), driest seasons 2005 and 2014, drought 2023 with 302 mm
  and moisture anomaly −0.07.

### 2.2 Planetary Computer (`pipeline/pc.py`)

- **Catalogue:** `https://planetarycomputer.microsoft.com/api/stac/v1`, anonymous
  access with SAS signature (`planetary_computer.sign`).
- **Analysis grid:** 1/4000° (~28 m N–S × 22 m E–W), aligned to whole degrees. Farms
  are rasterised onto it and each variable is averaged over all of their pixels.
  Farms without a pixel of their own (very small) take the pixel of their centroid.

| Collection | Product | Use |
| --- | --- | --- |
| `nasadem` | NASADEM, 1" | `altitud_m` (mean) and `pendiente_pct` (gradient on the grid) |
| `esa-worldcover` | WorldCover 2021 v200, 10 m | `wc_*_pct`: exact fraction of 3×3 pixels per analysis cell |
| `modis-13Q1-061` | MOD13Q1 v6.1 (Terra), 250 m, 16 days | NDVI 2019-10 → 2025-06 (130 composites, tile h17v05) |

- **NDVI:** scale 0.0001; pixels with `pixel_reliability` other than 0 (good) or
  1 (marginal) are discarded. Date = start of the composite + 8 days.
- **Verified gotchas:**
  - The catalogue has **several versions of the same composite** (reprocessed; e.g.
    `A2021257` appears 3 times). It is deduplicated by `AYYYYDDD` keeping the most
    recent production.
  - In Planetary Computer, MOD13Q1 **ends at `A2025177`** (end of June 2025): the 2025
    season has no July–September.
- **Estimated crop class per season.** Thresholds calibrated in Málaga with farms of
  ≥ 80% of a single WorldCover class (medians):

| Median NDVI | Crop | Grass | Trees |
| --- | --- | --- | --- |
| Summer (Jun–Aug) | 0.26 | 0.31 | 0.42 |
| Amplitude (p90−p10) | 0.33 | 0.24 | 0.16 |
| Autumn (Oct–Dec) | ~0.27 (late sowing) | ~0.40 | ~0.52 |

| Class | Rule (applied in this order) | Letter in `rotacion_estimada` |
| --- | --- | --- |
| `sin_datos` | < 12 valid composites | `?` |
| `sin_vegetacion` | max NDVI < 0.25 | `S` |
| `herbaceo_verano` | peak in May–August, max − Jan–Apr ≥ 0.12 and Jun–Aug ≥ Jan–Apr (sunflower) | `V` |
| `herbaceo_invierno` | peak in Feb–May, amplitude ≥ 0.25, Jun–Aug ≤ 0.33 and max − Oct–Dec ≥ 0.25 (cereal, legume) | `I` |
| `permanente` | amplitude < 0.2 and Jun–Aug ≥ 0.33 (trees, scrub, dense olive grove) | `P` |
| `barbecho_o_pastizal` | Jun–Aug < 0.4 (on a crop farm: fallow or weak harvest) | `B` |
| `mixto` | the rest | `M` |

- **Check against WorldCover** (farms ≥ 2.5 ha): crop → 56% `I` + 38% `B`;
  grass → 70% `B`; trees → 53% `P`; scrub → 61% `P`. Known confusion: open olive groves
  with a vegetation cover look like grass (`B`).

### 2.3 SIGPAC, skeleton only (`pipeline/sigpac.py`)

- **Download:** `https://sigpac-hubcloud.es/geopackages/2026/recintos/29_MALAGA_rec_2026_20251215_gpkg.zip`
  (403 MB; CC BY 4.0, author FEGA). All of Spain: 50 files, 34.5 GB.
- **Columns read:** `provincia, municipio, agregado, zona, poligono, parcela,
  recinto` and the geometry (for the area and for rasterising). Nothing else.
- **Málaga:** 969,034 enclosures in 363,401 farms (plots).
- **Gotcha:** the GeoPackage is in EPSG:4258; centroids are computed in
  EPSG:25830 (in the Canary Islands, EPSG:4083).

### 2.4 SoilGrids 2.0, ISRIC (`pipeline/soilgrids.py`, approved exception)

- **Endpoint:** `https://maps.isric.org/mapserv?map=/map/{prop}.map` (WCS 2.0.1, no
  key, CC BY 4.0). One crop per property and depth for the province bbox (35 requests
  in Málaga, 8 MB).
- **Properties:** clay, sand, organic carbon and coarse fragments from 0 to 100 cm;
  silt, pH, bulk density, nitrogen and CEC from 0 to 30 cm.
- **Calculation:** the centroid of each enclosure is sampled and averaged per farm
  weighted by area. Outputs: 0–30 cm mean and **available water 0–100 cm**
  (`cad_0_100_mm`), estimated with Saxton & Rawls (2006) discounting coarse fragments.
- **Verified gotcha:** the crop must be requested in the native projection
  (Homolosine, `+proj=igh`) with `SUBSET=X(...)&SUBSET=Y(...)`. With
  `SUBSETTINGSRS=EPSG:4326` it answers 404 `InvalidSubsetting`.
- **Source units:** clay, sand and silt in g/kg (÷10 → %); carbon in dg/kg
  (÷10 → g/kg); pH ×10; bulk density in cg/cm³ (÷100); nitrogen in cg/kg (÷100); CEC in
  mmol(c)/kg (÷10).
- **Result:** 356,481 of 363,401 farms with data (the rest, water or urban). In the
  Campiña de Antequera: ~32% clay, pH 7.8–7.9, carbon ~14 g/kg, ~130 mm of available
  water.
- **Limit:** 250 m resolution and a global statistical model. In the provincial mean
  the carbon (~22 g/kg) looks high for Andalusian agricultural soils: use it to
  compare farms, not as a laboratory analysis.

### 2.5 Prices, Eurostat (`pipeline/precios.py`, approved exception)

- **Endpoint:** `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/apri_ap_crpouta?geo=ES&currency=EUR`
  (JSON-stat, no key). "Selling prices of crop products": annual average selling
  price in Spain that the Ministry of Agriculture reports to Eurostat.
- **Content:** 87 products and 1,901 prices from 2000 to 2024 (8 provisional, flag
  `p`). For the case: soft and durum wheat, barley, oat, triticale, sunflower, pea,
  broad bean, lentil, chickpea, olive and oil. `precio_eur` is in Eurostat's unit
  (almost always 100 kg) and `precio_eur_t` in €/t.
- **2015–2024 means (€/t):** chickpea 756, sunflower 401, durum wheat 288, pea 250,
  soft wheat 213, barley 199. The 2022 peak (soft wheat 342 €/t) reflects the war in
  Ukraine.
- **First option discarded:** the European Commission's weekly per-market API
  (`api.tech.ec.europa.eu/agrifood/api/cereal/prices`) returned error 500 on
  14-11-2026, even with the examples from its documentation. If it comes back, it
  would give weekly prices per market (lonja).
- **Limits:** national and annual price, not of the Campiña or of the week of sale.
  Eurostat does not include vetch; for that there is the MAPA series in 2.6. It is not
  a forecast.

### 2.6 Vetch price, MAPA (approved exception)

- **Source:** MAPA, Anuario de Estadística 2025, table 7.2.7.2 "Veza. Serie histórica
  de superficie, rendimiento, producción, precio y valor". Average annual price
  received by the farmer, national, in €/100 kg.
- **URL:** `https://www.mapa.gob.es/estadistica/pags/anuario/2025/FORMATO%20PDF/AE25-C07/7.2.7.2.pdf`
- **Content:** 2014–2024. 2024 = 48.79 €/100 kg = 487.9 €/t. It is stored in
  `data/manual/precios_veza.csv` (copied to each `csv/comun/`) and joined by season in
  `prepare_inputs.py`.
- **Why not Eurostat:** the European nomenclature does not include grain vetch; it
  does include pea, broad bean, chickpea and lupins. No proxy is used.
- **Limits:** national and annual price, not from a lonja; there is no provincial
  price. The 2025 season uses 2024 as a reference. For green forage vetch, the Anuario
  publishes another table (7.6.3.5.1) that is not comparable with grain.
- **Complementary source:** Andalusian lonjas (Junta de Andalucía), grain vetch in Jaén
  (490 €/t in weeks 37–38 of 2026), consistent with the order of magnitude of MAPA.

## 3. Data model (CSV → SQLite)

Two copies, `data/malaga/` and `data/andalucia/`, each with `csv/comun/`,
`csv/<pp_provincia>/` (one folder per province) and `database/`. UTF-8, comma, decimal
point, `NULL` = empty cell, sorted by primary key. Integer keys for fast JOINs; the
SIGPAC code (`parcela_id`, `recinto_id`) is the stable identifier across versions.

| Table | Grain (one row per…) | Primary key | Source |
| --- | --- | --- | --- |
| `dim_municipio` | municipality | `municipio_key` | Skeleton |
| `dim_celda_power` | MERRA-2 cell | `celda_power` | POWER |
| `fincas` | SIGPAC plot | `finca_key` | Skeleton + NASADEM + WorldCover + MODIS |
| `recintos` | SIGPAC enclosure | `recinto_key` | Skeleton |
| `suelo_fincas` | farm with soil data | `finca_key` | SoilGrids |
| `fenologia_fincas` | farm × season (farms ≥ 2 ha) | `finca_key, campana` | MODIS |
| `ndvi_fincas` | farm × 16-day composite (farms ≥ 10 ha with ≥ 50% crop) | `finca_key, fecha` | MODIS |
| `clima_anual` | cell × season | `celda_power, campana` | POWER |
| `suelo_humedad_anual` | cell × season | `celda_power, campana` | POWER |
| `dim_producto_precio` | agricultural product | `producto_codigo` | Eurostat |
| `precios_anuales` | product × year | `producto_codigo, anio` | Eurostat |
| `precios_veza` | year | `anio` | MAPA (transcribed) |

- **Schema** with foreign keys, indexes and views (`v_fincas`, `v_candidatas`,
  `v_clima_suelo_anual`): [`pipeline/sql/schema.sql`](../pipeline/sql/schema.sql) (copied to each `data/<copy>/database/`); example queries in [`pipeline/sql/consultas.sql`](../pipeline/sql/consultas.sql).
- **Database:** `python3 pipeline/cargar_sqlite.py malaga|andalucia` generates
  `data/<copy>/database/ciberpiso_<copy>.sqlite` **from the CSVs**, checks that the
  columns match the schema and validates the foreign keys.
- **Sizes (Málaga):** `fincas` 363,401 rows (57 MB), `recintos` 969,034 (67 MB),
  `suelo_fincas` 356,481 (26 MB), `fenologia_fincas` 296,238 (21 MB), `ndvi_fincas`
  201,292 (6 MB), `clima_anual` and `suelo_humedad_anual` 240 each. SQLite: 269 MB.
- **Access:** typical queries (farms of a municipality, farm by SIGPAC code, NDVI
  series of a farm, phenology + climate + moisture of a farm) use an index or the
  primary key and take < 1 ms.
- **Candidates** (`es_candidata = 1`): plot ≥ 50 ha, ≥ 60% crop (WorldCover),
  slope ≤ 12%, ≥ 5 of 6 arable seasons (`I`, `V` or `B`) with at least one `I`, and
  no summer irrigation signal (Jun–Aug NDVI < 0.55). **Result: 60 in Málaga, 26 in
  Antequera**, all in the Campiña (Antequera, Campillos, Teba, Fuente de Piedra,
  Sierra de Yeguas). Also in `data/processed/geo/fincas_candidatas.geojson`.
  - Why not 150–250 ha: the plan describes a *holding* of 150–250 ha in 5–20 plots.
    Without the declared crop from SIGPAC, plots cannot be grouped into holdings, and
    in Antequera only 2 loose plots of that size are cropland.
  - Example: `29:15:0:0:62:14` (96 ha, 99% crop, slope 4%) → `I-B-I-B-I-B`,
    cereal–fallow "año y vez" (alternate-year).

## 4. How to reproduce it

```bash
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r pipeline/requirements.txt
.venv/bin/python -m pipeline.sigpac --provincias 4,11,14,18,21,23,29,41 --borrar-zip  # skeleton
.venv/bin/python -m pipeline.power  --provincias 4,11,14,18,21,23,29,41   # climate and moisture
.venv/bin/python -m pipeline.pc     --provincias 4,11,14,18,21,23,29,41   # SRTM, WorldCover, MODIS
.venv/bin/python -m pipeline.soilgrids --provincias 4,11,14,18,21,23,29,41  # soil
.venv/bin/python -m pipeline.precios                    # prices (Eurostat)
.venv/bin/python -m pipeline.build --ambito andalucia              # Andalucía CSVs
.venv/bin/python -m pipeline.subconjunto --de andalucia --a malaga  # Málaga copy
python3 pipeline/cargar_sqlite.py andalucia                          # SQLite (and malaga)
```

Every download is recorded in `data/manifest.json` (URL or collection, date, size and
SHA-256).

## 5. Andalucía (8 provinces)

Same pipeline, `--provincias 4,11,14,18,21,23,29,41`. Run on 14-11-2026 in ~1 h
(SIGPAC download 25 min; Planetary Computer 35 min).

| Province | Farms | Area, ha | % crop | Candidates |
| --- | --- | --- | --- | --- |
| 04 Almería | 487,398 | 876,613 | 4.7 | 6 |
| 11 Cádiz | 96,831 | 743,329 | 29.1 | 581 |
| 14 Córdoba | 342,866 | 1,376,610 | 17.3 | 617 |
| 18 Granada | 590,259 | 1,263,818 | 13.9 | 78 |
| 21 Huelva | 183,922 | 1,013,163 | 7.9 | 66 |
| 23 Jaén | 629,141 | 1,348,134 | 4.8 | 34 |
| 29 Málaga | 363,401 | 730,474 | 12.2 | 60 |
| 41 Sevilla | 215,222 | 1,404,648 | 35.7 | 1,294 |
| **Total** | **2,909,040** | **8,756,789** | | **2,736** |

- 6,817,265 enclosures; 47 POWER cells; a 2.2 GB SQLite database generated from the
  CSVs in ~70 s.
- CSVs in one folder per province (`data/andalucia/csv/<pp_provincia>/`); the largest
  is `23_jaen/fincas.csv` with 97 MiB, just below GitHub's 100 MiB limit.
- **Warnings when reading the crop class outside Málaga:** the NDVI thresholds were
  calibrated in Málaga. In Almería, greenhouses count as crop in WorldCover but give
  low NDVI (`sin_vegetacion`); on the Granada high plateau something similar happens
  with very poor rainfed cereal. Jaén has little "crop" because WorldCover classifies
  almost all olive groves as trees.
- To save disk, `pipeline.sigpac --borrar-zip` deletes each zip after extracting it,
  and the GeoPackages can be deleted after `pipeline.pc` (the candidates GeoJSON only
  includes the provinces whose GeoPackage is still on disk).

## 6. Gaps (because of the "only `resources.md`" rule)

- **Prices:** only national and annual (Eurostat); no local lonja price, nor for vetch.
- **Soil:** texture and chemistry come from SoilGrids (approved exception, 250 m);
  moisture, from POWER/MERRA-2 (~50 km). SMAP (9 km) would need Earthdata Login.
- **Real crop:** the crop is an **NDVI estimate** at 250 m, not the declared crop. On
  farms < 6 ha the MODIS pixel mixes neighbours.
- **Rainfed/irrigated:** there is no direct data; only the summer NDVI signal.
- **Holding (the farmer's farm with several plots):** it cannot be reconstructed
  without the declared crop from SIGPAC, which is not in `resources.md`.
- **Sources tested and discarded** because they are not in `resources.md`: SIGPAC
  declared crop 2025 and prices from the European Commission's agri-food API. They
  worked; they can be reactivated if the team changes the rule.
