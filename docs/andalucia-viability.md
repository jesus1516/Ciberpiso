# Viability: extending the farm-level explorer from Málaga to all of Andalucía

Report only (ticket T-11). Nothing in the app or the pipeline was changed.
Every number says where it comes from: **measured** (I ran it), **counted** (read from a file),
**modelled** (extrapolated, with the formula) or **assumed** (a guess to be checked).

## 0. Verdict

**Yes, it is viable, and the data is mostly ready.** The harmonised CSVs for all 8 provinces
already exist (2,909,040 farms). What is missing is only the *app* layer for 7 provinces:

| | Málaga today | All 8 provinces |
|---|---|---|
| Farms | 363,401 | 2,909,040 (8.0×) |
| App data (gzip) | 55.6 MB (measured) | **≈ 450 MB** (181 MB measured + 263 MB modelled + 4 MB small files) |
| Export time | not recorded | **≈ 1–1.5 h** unattended (download 25 min, detail export 6.4 min measured, farm geometry 35–70 min assumed) |
| Peak disk while exporting | n/a | **≈ 3 GB** one province at a time; ≈ 12 GB if all GeoPackages are kept |
| Work | – | **≈ 55 h** (43–71 h) in total, **≈ 28 h** (24–36 h) to get the first extra province live |

Recommendations, in one line each:

1. **Do not commit the new data to git.** Host it in a static bucket/CDN and point the app at it
   through one base URL. Keep Málaga and the small files in the repo.
2. **Go province by province:** fix the pipeline naming bugs (section 6), pilot with **Sevilla**
   (35.7 % cropland, 1,294 candidate farms, smaller than Málaga), then Córdoba, Cádiz, Huelva,
   Jaén, Granada and Almería last.
3. **Budget ≈ 55 hours**, of which ≈ 28 h unlock the first extra province (arithmetic in section 4).

Two things I found that would have bitten an "all provinces" run (details in section 6):
`export_app_detalle.py` for Sevilla **deletes 7 Almería files** (keys 4100–4106), and the app and
the exporters disagree on file names for provinces below 10 (`municipios_4` vs `municipios_04`).

## 1. Data available today

### 1.1 Full CSVs per province

Source: `data/andalucia/csv/<prov>/` in the read-only data directory. Sizes with `du -sh`; rows with
`wc -l` minus the header (**counted**). The Málaga rows equal `data/malaga` (same keys, same rows,
`data/README.md`).

| Province | Size | Farms (`fincas.csv`) | Recintos | `suelo_fincas` | `fenologia_fincas` | `ndvi_fincas` | Municipalities | POWER cells |
|---|---|---|---|---|---|---|---|---|
| 04 Almería | 210 MB | 487,398 | 1,158,222 | 481,037 | 412,680 | 85,768 | 103 | 11 |
| 11 Cádiz | 69 MB | 96,831 | 310,922 | 89,333 | 186,990 | 562,355 | 45 | 9 |
| 14 Córdoba | 179 MB | 342,866 | 782,512 | 340,464 | 515,076 | 599,137 | 77 | 11 |
| 18 Granada | 267 MB | 590,259 | 1,362,872 | 583,240 | 525,174 | 306,412 | 174 | 12 |
| 21 Huelva | 91 MB | 183,922 | 459,694 | 181,106 | 250,158 | 109,136 | 80 | 9 |
| 23 Jaén | 261 MB | 629,141 | 1,217,610 | 627,271 | 524,856 | 119,951 | 97 | 11 |
| 29 Málaga | 170 MB | 363,401 | 969,034 | 356,481 | 296,238 | 201,292 | 103 | 10 |
| 41 Sevilla | 156 MB | 215,222 | 556,399 | 212,106 | 499,518 | 1,385,085 | 106 | 10 |
| **Total** | **1.4 GB** | **2,909,040** | **6,817,265** | | | | **785** | **47 distinct** |

- 6,817,265 recintos matches `docs/fuentes-scraping.md` §5. 785 municipalities is the real number for
  Andalucía. POWER cells straddle province borders (the per-province counts add up to 83, there are 47
  distinct cells in `data/andalucia/csv/comun/dim_celda_power.csv`, 48 lines with the header).
- `data/andalucia/csv/comun/` is shared: `clima_anual.csv` (1,128 rows = 47 cells × 24 campaigns),
  `suelo_humedad_anual.csv`, `precios_anuales.csv`, `precios_veza.csv`, `dim_*`. About 200 kB in total.
- The largest file in git is `23_jaen/fincas.csv`, 101,866,554 bytes = 97.15 MiB, under GitHub's
  100 MiB block (`git rev-list --objects --all | git cat-file --batch-check`).

### 1.2 What the app needs per municipality

All paths under `app/public/data/` (Málaga, **counted**: 103 municipalities, 363,401 farms):

| File | Content | Size (Málaga) | Produced by |
|---|---|---|---|
| `fincas/<municipio_key>.geojson.gz` | farm polygons (dissolved recintos, simplified 1.5 m, 5 decimals) + 11 short properties, incl. `apt` | 35.2 MB total (103 files) | `pipeline/export_app_fincas.py` |
| `detalle/<municipio_key>.json.gz` | relief, cover, soil, phenology, NDVI series per farm | 20.4 MB total (103 files) | `pipeline/export_app_detalle.py` |
| `comun_29.json` | climate per POWER cell (24 campaigns) + 12 price series | 113 kB (10 cells) | `export_app_detalle.py` (`_comun`) |
| `municipios_29.geojson` | municipality outlines + counts | 418 kB | `export_app_fincas.py` |
| `municipios_29_stats.json` | cropland %, rainfall, water deficit per municipality | 6.3 kB | `pipeline/export_app_andalucia.py` |
| `provincias_andalucia.geojson` | 8 provinces + rest of Spain, already with the farm counts of all 8 | 178 kB | `export_app_andalucia.py` |

Measured totals for Málaga: fincas 35,171,064 B + detalle 20,393,872 B = **55.6 MB**,
i.e. **153 B per farm** (96.8 + 56.1). `app/dist` is 67 MB and `app/public` 64 MB; the difference to 55.6 MB
is the old Antequera files (9 MB `fincas_antequera.geojson`, 0.8 MB indicators).

### 1.3 How they are produced

- **`pipeline/sigpac.py`**: lists the FEGA zips (`https://sigpac-hubcloud.es/geopackages/2026/recintos/`),
  downloads one per province, extracts the `.gpkg` to `data/raw/sigpac/extract/<pp>_recintos/` and writes a
  skeleton parquet (centroid per recinto). The GeoPackage is what the exporter needs.
- **`export_app_fincas.py --provincia N`**: reads `fincas.csv` for the attributes, reads the **GeoPackage**
  for the geometry, dissolves recintos into farms (`make_valid`, `dissolve`, `simplify(1.5)`), computes `apt`
  (`aptitud()`), writes one gz GeoJSON per municipality and the municipality outline file.
- **`export_app_detalle.py --provincia N`**: **CSV only**, no geometry. Joins `fincas`, `suelo`, `fenologia`,
  `ndvi`, writes one gz JSON per municipality and the `comun_*.json`.
- **`export_app_andalucia.py --provincia N`**: province outlines (`es-atlas`) and the municipality stats.

Consequence: the detail export for all provinces can run **today** from the CSVs. Only the farm
geometry needs the 8 GeoPackages.

## 2. Estimated output size and hosting

### 2.1 Size for the 8 provinces

**Detail files: measured.** I ran the real `export_app_detalle.exportar()` for each province, with the CSV
directory read-only and the output redirected to `/tmp` (method in the appendix). The output for Málaga is
byte-identical in size (20,393,872 B) to the committed files.

**Farm geometry: modelled**, because the GeoPackages are not on this machine. For Málaga, the gzip size of each
of the 103 municipality files was regressed on its farms and recintos (least squares):

`bytes = 51.47 × farms + 16.62 × recintos`, R² = 0.93 (Málaga, 103 points; the largest, Málaga city
29900, is 16,919 farms and 2.1 MB).

Cross-checks of the model (all give the same order of magnitude): 96.8 B × farms = 281.5 MB; 36.3 B × recintos =
247.4 MB. The model is in the middle (263.0 MB). Larger farms (Cádiz 7.7 ha/farm, Sevilla 6.5, Huelva 5.5 against
Málaga 2.0) may have more vertices per farm, so I give **±25 %** on this part.

| Province | Farms | Recintos | Detail (measured) | Farm geometry (modelled) | Total | Per farm |
|---|---|---|---|---|---|---|
| 04 Almería | 487,398 | 1,158,222 | 25.0 MB | 44.3 MB | 69.3 MB | 142 B |
| 11 Cádiz | 96,831 | 310,922 | 10.3 MB | 10.2 MB | 20.4 MB | 211 B |
| 14 Córdoba | 342,866 | 782,512 | 25.1 MB | 30.7 MB | 55.8 MB | 163 B |
| 18 Granada | 590,259 | 1,362,872 | 32.5 MB | 53.0 MB | 85.5 MB | 145 B |
| 21 Huelva | 183,922 | 459,694 | 12.4 MB | 17.1 MB | 29.5 MB | 160 B |
| 23 Jaén | 629,141 | 1,217,610 | 31.1 MB | 52.6 MB | 83.7 MB | 133 B |
| 29 Málaga | 363,401 | 969,034 | 20.4 MB | 34.8 MB (real 35.2) | 55.2 MB (real 55.6) | 152 B |
| 41 Sevilla | 215,222 | 556,399 | 24.7 MB | 20.3 MB | 45.1 MB | 210 B |
| **Total** | **2,909,040** | **6,817,265** | **181.4 MB** | **263.0 MB** | **444.5 MB** | **153 B** |

Small files for the whole region: municipality outlines 785 / 103 × 418 kB ≈ 3.2 MB (modelled by municipality
count); a single `comun.json` for the 47 cells is 525,722 B raw, 58,306 B gzipped (**measured** with
`_comun()` on the 47 cells); stats ≈ 48 kB (6.3 kB × 785/103).

**Total ≈ 450 MB** (181 + 263 + 3.2 + 0.5 + 0.2), range ≈ 385–520 MB with the ±25 % on geometry.
That is 1,570 data files (785 × 2), the largest being about 2 MB each (Sevilla 41039 detail: 2,054,126 B measured).

**What one user downloads.** The app fetches one municipality at a time: on average 450 MB / 785 = **0.57 MB**
(farms + detail). The largest case is Huércal-Overa (4053): 36,051 farms, 76,786 recintos → model 3.1 MB geometry +
1.53 MB detail (measured) ≈ **4.7 MB**, and about 25 MB of raw JSON to parse (Málaga city is 12.1 MB raw for 16,919 farms
= 714 B/farm; 36,051 × 714 B ≈ 25.7 MB). Eleven municipalities have more farms than Málaga city.

### 2.2 Where to host it

GitHub facts below come from the GitHub Docs search results for "repository limits" and "Git LFS"
([Repository limits](https://docs.github.com/en/repositories/creating-and-managing-repositories/repository-limits),
[About Git LFS](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-git-large-file-storage),
[Git LFS billing](https://docs.github.com/billing/managing-billing-for-git-large-file-storage/about-billing-for-git-large-file-storage)).
I could **not** confirm the numbers marked *(verify)*; check them before deciding.

- Single file: blocked at 100 MB. No planned file is anywhere near it (largest ≈ 2 MB).
- Repository: GitHub recommends keeping it small; the page I found lists 10 GB on disk as the recommended
  limit and a push limit of 2 GB *(verify: older guidance said < 1 GB ideal, < 5 GB strong limit)*.
- Today the repository pack is already **420.5 MiB** (`git count-objects -vH`; blobs total 1.69 GB uncompressed,
  mostly the CSVs). Files are already gzip-compressed, so git cannot shrink them further.
- LFS: free accounts get 10 GiB storage and 10 GiB/month bandwidth *(verify)*; LFS objects cannot be served
  by GitHub Pages (docs search result).
- Release assets: I recall a limit of 1,000 assets per release and 2 GiB per asset *(verify)*, and release
  downloads redirect to another host without reliable browser CORS headers *(not tested)*.

| Option | Fits? | Pros | Cons |
|---|---|---|---|
| **A. Commit to git** | 450 MB new + 420 MB existing ≈ 0.9 GB; every regeneration adds another copy to history (~450 MB of incompressible blobs) | Zero new infrastructure; `npm run build` ships it | Repo clones become slow and keep growing; history cannot be pruned without rewriting; every contributor downloads data they do not need |
| **B. Git LFS** | Storage OK, bandwidth tight if the free quota is 1–10 GiB | Keeps git history small | Not served by Pages; each fetch counts bandwidth; a quota overrun blocks LFS; extra setup for every clone |
| **C. GitHub Releases** | 1,570 files exceed 1,000 assets/release *(verify)* | Good for one archive (`andalucia-data.tar`, ~450 MB) as a reproducible backup | Not usable for per-file fetch from the browser (CORS, redirects, asset count) |
| **D. Static bucket + CDN** (Cloudflare R2, S3 + CloudFront, GCS) | 450 MB is tiny; at 0.57 MB per municipality visit, 100 k visits ≈ 57 GB egress | Cheap or free tier; CORS and cache headers under our control; data is decoupled from code releases; the app bundle stays 5 MB | Needs an account, a CORS rule and an upload step; one more thing to keep alive |
| **E. Hybrid** | Málaga and small files in git, the rest in D | Works offline for the demo province; the repo grows by 3–4 MB only | Two sources of data to document |

**Recommendation: E, with D as the main store.** Keep `app/public/data` as is (Málaga + outlines), add a
`VITE_DATA_URL` base for the other provinces, upload with a script, and keep a tarball in a GitHub Release as the backup.
Two compatibility notes from the code: the app already accepts both gzip bytes and plain JSON
(`lib/farms.ts` `readGeojson`, `lib/detail.ts` `gunzipJson` check the `1f 8b` magic), so the bucket may serve the
`.gz` files as-is or with `Content-Encoding: gzip`. The app does not set any `Cache-Control`; set
`public, max-age=31536000, immutable` on the files in the bucket (the gz is deterministic: `mtime=0`).

## 3. Processing time and disk

### 3.1 Time

| Step | Basis | Málaga | 8 provinces |
|---|---|---|---|
| Download 8 GeoPackage zips | `manifest.json`: 3,030 MB total (546.6 + 150.8 + 361.6 + 601.1 + 235.2 + 456.3 + 403.4 + 275.3). `docs/fuentes-scraping.md` §5: "SIGPAC download 25 min"; the `retrieved_at` stamps of the 6 zips after Almería are 18.8 min apart for 2,080 MB = 1.84 MB/s | ≈ 3.7 min | **≈ 25 min** (counted from a past run; depends on the line and the FEGA server) |
| Extract each zip | **assumed** 1–2 min per GB of zip | ≈ 1 min | ≈ 5–6 min |
| `export_app_detalle` | **measured** (single process, `time`): 38.5 s Málaga; per province 58.6 / 17.3 / 47.4 / 72.4 / 28.6 / 77.1 / 38.5 / 44.1 s (04/11/14/18/21/23/29/41) | 38.5 s | **384 s ≈ 6.4 min** (0.13 ms per farm) |
| `export_app_fincas` | **not measured** (no GeoPackage here, no earlier timing recorded). Work is dominated by `make_valid` + `dissolve` + `simplify` on the recintos, so it should scale with recintos: 6,817,265 / 969,034 = 7.0× Málaga. **Assumed** 5–10 min for Málaga | 5–10 min | **35–70 min** |
| `export_app_andalucia` (stats) | reads each `fincas.csv` once; **assumed** < 1 min per province | < 1 min | ≈ 5 min |

**Total ≈ 1.2–1.8 h**, almost all of it unattended; the unmeasured parts are the extraction and the geometry export,
and both are checked by the pilot (section 7, step 2). The upstream pipeline (SoilGrids, POWER, Planetary Computer, `build`) was
already run for all 8 provinces in about 1 h (`docs/fuentes-scraping.md` §5), so it does **not** need to be repeated.

Note `pipeline.sigpac.run()` also computes the centroid skeleton parquet for every recinto
(`esqueleto()`: `to_crs` + `centroid` on up to 1.36 M polygons). The CSVs already exist, so this is wasted
time for this purpose. A `--only-download` flag (or a small script) would save a few minutes per province.

### 3.2 Disk

- **Zips:** 3,030 MB for the 8 (manifest). **Extracted GeoPackages:** not measured here. **Assumed** 2–3× the zip
  (SQLite + geometry compresses well): 6–9 GB for 8, ≈ 1.8 GB for Granada alone.
- **Outputs:** ≈ 450 MB in `app/public/data` or the staging folder.
- **Peak** doing one province at a time with `--borrar-zip`, then deleting the `.gpkg`: Granada's zip (0.6 GB)
  + extracted (≤ 1.8 GB assumed) + output ≈ **3 GB**. Keeping everything: ≈ 12 GB.
- **Reality check on this Mac:** `df -h /` shows **1.8 GiB free** (87 % used). The one-province-at-a-time flow
  would not even fit; free at least **5 GB**, ideally 15 GB, or use an external disk (set `data/raw` to it).

### 3.3 Machine requirements

- Python 3.13 with `geopandas 1.2.0`, `pyogrio 0.13.0`, `pandas`, `rasterio` (`pipeline/requirements.txt`). The
  Anaconda Python on this Mac **does not have geopandas** (only pandas 3.0.3), so a venv is needed.
- RAM: detail export **measured** ≈ 0.5 GB RSS (largest province, Granada, 590 k farms). Farm export **not measured**;
  geopandas keeps the 1.36 M Granada recintos plus the dissolve in memory, **assumed** 3–6 GB. This Mac has 16 GB and 8 cores,
  enough. The exports are single-process; the 8 provinces are independent, so 2–3 in parallel are possible
  with ≥ 16 GB if time matters.
- Network: ≈ 3 GB downloaded, from `sigpac-hubcloud.es` (CC BY 4.0, FEGA).

## 4. App changes needed

I read `lib/farms.ts`, `lib/detail.ts`, `store.ts`, `explorer/controller.ts`, `explorer/Explorer.tsx`,
`explorer/state.ts`. The farm view, the 3D scene and the calculator are already province-agnostic.

| # | Change | Where | Why | Hours |
|---|---|---|---|---|
| 1 | Province-aware data layer: `PROVINCE = 29` and `municipios_${PROVINCE}.geojson` become a parameter; derive the province of a municipality from `mun / 1000` (already how `farmByPid` does it) | `lib/farms.ts` (`PROVINCE`, `loadMunicipalities`, `DEMO_MUNICIPALITY`), `components/*` that use them | one hard-wired province | 3–4 |
| 2 | Climate: `loadCommon(prov = 29)` caches **one** promise in a module variable, so the second province would silently get Málaga's cells. Replace with a single `comun.json` for the 47 cells (58 kB gz) | `lib/detail.ts`, callers in `store.ts`, `controller.ts:530,580` | cells straddle provinces (83 per-province cell slots for 47 distinct cells), so per-province files would duplicate them and cannot be keyed by province alone | 1–2 (+ pipeline part in §6) |
| 3 | Level 1 for any province: replace the literal `'29'` and the `malaga` field by a selected province; glow, labels, hover texts, toast, `totals.malaga`, `LEVEL_NAMES`, `aria-label`, `i18n` strings with "Málaga"; load municipality outlines on demand per province, with stats | `explorer/controller.ts` (≈ 25 places: lines 109–113, 144, 189, 204, 254, 307–347, 381, 692–693, 717–720), `Explorer.tsx` (34, 41, 88–105, 124, 199), `state.ts`, `i18n/en.ts` | the funnel is Andalucía → Málaga → municipality → farm | 8–12 |
| 4 | Stats per province: `municipios_<p>_stats.json` for all 8 (the exporter takes `--provincia`; the app reads only `_29_`) | `controller.ts:185`, `export_app_andalucia.py` | colouring of the municipality level | 1 |
| 5 | Calculator: **already works anywhere**: `scenarioFor(detail, common)` only needs the farm's `celda` and the prices (`lib/calculator.ts:89`). Extend `scripts/check-calculator.ts` with one farm per province | `scripts/check-calculator.ts` | prove it, 1,144 Málaga values are compared today | 2–3 |
| 6 | Review of calibrations done in Málaga (see §5): `aptitud()` thresholds, NDVI classes, calculator calibration | `export_app_fincas.py`, `data/calibration.json` | product decision, not code | 3–7 |
| 7 | Performance with larger municipalities (section 4.1) | `controller.ts`, `lib/farms.ts` | Huércal-Overa has 2.1× Málaga city | 6–10 |
| 8 | Hosting: `VITE_DATA_URL`, upload script, CORS test, cache headers | `lib/*` `DATA` constants (3 places), a script | section 2.2 | 4–6 |
| 9 | QA of each province on the map and docs | – | | 4–6 |
| | **Total app work** | | | **32–51 h** |

How the totals in the verdict are built (sums of the ranges above):

- App work, items 1–9: 3+1+8+1+2+3+6+4+4 = **32 h** to 4+2+12+1+3+7+10+6+6 = **51 h**.
- Pipeline fixes (§6, plan step 1): **4–6 h**. Subtotal "build": **36–57 h**.
- Running and checking each of the 7 extra provinces (export, upload, map check): **1–2 h each = 7–14 h**.
- **Grand total 43–71 h, central ≈ 55 h.**
- First extra province live = pipeline fixes (4–6) + items 1, 2, 3, 4, 5, 8 (3+1+8+1+2+4 = 19 to 4+2+12+1+3+6 = 28) + its own run (1–2) =
  **24–36 h, central ≈ 28 h**. Items 6, 7 and 9 (review, performance, QA) can follow in later steps.

### 4.1 Performance with more data

- **Per-municipality download is the unit** (section 2.1): average 0.57 MB, worst 4.7 MB. Nothing grows with the
  number of provinces except the 785-municipality outline set (≈ 3.2 MB raw if loaded at once; load one province's
  outlines on demand to keep the first load small).
- **Largest municipalities:** Málaga city is the stress case today (16,919 farms, 12.1 MB raw). Eleven Andalusian
  municipalities exceed it: Huércal-Overa (4053) 36,051; Níjar (4066) 23,487; Alcalá la Real (23002) 22,059; Martos (23060) 21,927; Adra (4003) 21,725 (counted from `fincas.csv`).
  Expect ≈ 25 MB of JSON and a one-off MapLibre `geojson-vt` tiling pass; **not measured**, the real test is a browser pass on Huércal-Overa. If
  it is too slow: tighter simplification for this size (the 1.5 m tolerance is generous), dropping properties
  that are only used in the farm view, or serving vector tiles.
- **Memory in the browser:** the `byId`/`byPid` maps in `lib/farms.ts` keep every loaded farm, never evicted. For a
  session that opens a dozen municipalities, that is fine; add an eviction rule only if the pilot shows trouble.
- **Bundle:** unchanged. The new data is lazy and sits outside `dist`.

## 5. Quality risks of the data outside Málaga

From `docs/fuentes-scraping.md` §5 and the exporters:

- The NDVI class thresholds were calibrated in Málaga; "greenhouses count as cropland in WorldCover but have low NDVI
  (`sin_vegetacion`)" in Almería; very poor dry cereal in Granada's plateau behaves like that too; Jaén has little "cropland"
  (4.8 %) because WorldCover classifies most olive groves as woodland.
- `aptitud()` (blocked/limited farms) comment says "woodland on gentle slope is not flagged: in Málaga it is usually olive or almond",
  the rule was written for Málaga. Candidates (`es_candidata`) per province: 6 Almería, 581 Cádiz, 617 Córdoba, 78 Granada,
  66 Huelva, 34 Jaén, 60 Málaga, 1,294 Sevilla (counted, 2,736 in total). The rotation story fits the cereal belt (Sevilla, Cádiz, Córdoba), not Almería or Jaén.
- Soil (SoilGrids, 250 m) and climate (POWER, ≈ 50 km) resolution is the same everywhere; climate is coarser than the
  differences between neighbouring municipalities in the Sierra.
- Prices are national and annual (Eurostat), the same for all provinces; there is no regional price.

## 6. Risks and bugs found

| Risk | Evidence | Impact | Mitigation |
|---|---|---|---|
| **Sevilla's cleanup deletes Almería files** | `export_app_detalle.py` and `export_app_fincas.py` do `carpeta.glob(f"{prov:02d}*...")`; for Sevilla that is `41*`, which matches Almería keys 4100–4106. **Measured:** after exporting 04 then 41, Almería had 96 detail files instead of 103; re-running Almería gave 103 | 7 Almería municipalities silently lose data, depending on run order | Delete only files whose `int(stem) // 1000 == prov` |
| **File names disagree for provinces < 10** | exporters write `municipios_{prov:02d}.geojson` and `comun_{prov:02d}.json` (`municipios_04.geojson`); the app asks for `municipios_${PROVINCE}` and `comun_${prov}` (`municipios_4`, `comun_4`) | Almería would 404 | One convention (recommend no zero padding, or always the two-digit province code) in both sides |
| Cleanup for province 04 never matches | `glob("04*")` matches nothing since Almería files are named `4001…` | stale files after a re-export | same fix as above |
| `loadCommon` is a singleton | `lib/detail.ts` | wrong climate for the second province | single `comun.json` (§4, item 2) |
| Disk full | 1.8 GiB free on this Mac | the run fails halfway | free ≥ 5–15 GB or external disk |
| Geometry export runtime/RAM unknown | §3 | plan error up to 2× | measure on Cádiz first (smallest, 150.8 MB zip) |
| Data source | FEGA hubcloud URL pinned to `20251215` | URL may change with the 2027 release | the SHA-256 of each zip is in `manifest.json` |
| Quality of "cultivo" and candidates outside the cereal belt | §5 | misleading farm flags in Almería/Jaén | review thresholds before publishing those two provinces; mark them "experimental" in the UI meanwhile |
| Hosting cost / uptime | §2.2 | small | R2/S3 free tiers cover 450 MB; keep the tarball in a Release |
| Repo growth if committed | §2.2 | slow clones | do not commit provinces other than Málaga |
| Licences | SIGPAC CC BY 4.0 (FEGA), SoilGrids CC BY 4.0, Eurostat CC BY 4.0, es-atlas CC BY 4.0 | attribution needed per province too | the in-app attribution already lists them (`controller.ts`) |

## 7. Recommended plan

1. **Pipeline fixes (4–6 h).** File-name convention; cleanup glob by `key // 1000`; a single `comun.json`; a loop
   `--provincia all` that does *download → extract → export → delete gpkg*; skip the skeleton parquet. Free disk.
   Verify with a unit test of the names and by re-running Málaga: the 103 + 103 files must be byte-identical.
2. **Pilot: Cádiz geometry run (1 h of work, ~20 min of machine).** Smallest province (96,831 farms, 150.8 MB zip),
   only to **measure** extraction time, GeoPackage size, export time and RAM, and replace the assumed numbers of §3.
3. **Province 2 = Sevilla (≈ 20–30 h incl. app items 1–5, 8 and its run).** 35.7 % cropland, 1,294 candidates, 215,222 farms (below
   Málaga) ≈ 45 MB. Host it in the bucket, enable level 1 for any province, run the calculator check on one farm.
4. **Córdoba, Cádiz, Huelva (1–2 h each, 3–6 h).** Same cereal/olive belt; mostly data.
5. **Stress and quality pass (items 6, 7, 9: 13–23 h).** Huércal-Overa and the other large municipalities in a real browser, `aptitud()` review for
   greenhouses and olive.
6. **Granada, Jaén, Almería (1–2 h each, 3–6 h, plus the review above).** Last, because of size and quality caveats. Almería
   also tests 4-digit keys.
7. **Close (≈ 2 h):** tarball in a Release, update `app/README.md` and `data/README.md`.

Go/no-go checkpoints: after step 2 (numbers match the model within 2×), after step 3 (Sevilla runs end to end in the
browser with a total first-load under ≈ 6 MB), after step 5 (Huércal-Overa opens in under ≈ 5 s on a mid laptop; thresholds are **targets
to be agreed**, not measured values).

## Appendix: how the measurements were made

- Row counts and sizes: `wc -l`, `du -sh`, `pandas.read_csv` on the read-only copy; nothing was written there.
- Málaga output sizes: `os.path.getsize` over `app/public/data/{fincas,detalle}/`.
- Regression: `numpy.linalg.lstsq` of the municipality gz size on `[farms, recintos]` per municipality (103 points).
- Detail export: a script in `/tmp` (outside the repository) that stubs `geopandas`/`pyogrio` (the detail export does not use
  them but imports the module that does), sets `pipeline.common.DATA` to the read-only directory, `SALIDA` to a `/tmp` folder, and
  calls `export_app_detalle.exportar(prov)` for each province, timing every call. Python `/opt/anaconda3/bin/python3`, 8 cores, 16 GB.
  The Almería time is from the re-run (58.6 s); the first run took 50.1 s but its files were partly deleted by the Sevilla cleanup.
- GitHub limits: see the links in section 2.2; items marked *(verify)* were not confirmed.
