# Ciberpiso data

SIGPAC farms with climate, soil moisture, relief, land cover, soil, satellite-estimated
crop and prices. There are **two independent copies**, each with its own CSVs and its
own database:

| Copy | Provinces | Farms | CSV | SQLite database |
| --- | --- | --- | --- | --- |
| `malaga/` | 29 Málaga | 363,401 | ~180 MB | ~275 MB |
| `andalucia/` | all 8 of Andalucía | 2,909,040 | ~1.4 GB | ~2.2 GB |

The Málaga copy is exactly the Málaga part of the Andalucía one (same keys and same
rows). The sources and their limits are in
[`docs/fuentes-scraping.md`](../docs/fuentes-scraping.md).

```text
data/
├── malaga/
│   ├── csv/
│   │   ├── comun/              climate, soil moisture, climate cells and prices
│   │   └── 29_malaga/          farms, enclosures, soil, phenology, NDVI and municipalities
│   └── database/
│       ├── ciberpiso_malaga.sqlite   (generated; not pushed to git)
│       ├── schema.sql          tables, keys, indexes and views
│       └── consultas.sql       16 example queries
├── andalucia/
│   ├── csv/
│   │   ├── comun/
│   │   ├── 04_almeria/  11_cadiz/  14_cordoba/  18_granada/
│   │   └── 21_huelva/   23_jaen/   29_malaga/   41_sevilla/
│   └── database/
│       ├── ciberpiso_andalucia.sqlite   (generated; not pushed to git)
│       ├── schema.sql
│       └── consultas.sql
├── manual/precios_veza.csv     MAPA vetch series transcribed by hand (copied to each csv/comun/)
├── crops.csv, rotation_content.json, calibration.json   catalogue and content of the calculator
├── manifest.json               record of each download (URL, date, size, SHA-256)
├── raw/                        original downloads (not versioned)
└── processed/                  pipeline intermediates (not versioned)
```

`schema.sql` and `consultas.sql` are identical in both copies; their single source is in
`pipeline/sql/`.

## Create the database on any machine

All you need is Python 3.8 or later, nothing else to install. From the repo root:

```bash
python3 pipeline/cargar_sqlite.py malaga       # ~10 s  -> data/malaga/database/ciberpiso_malaga.sqlite
python3 pipeline/cargar_sqlite.py andalucia    # ~70 s  -> data/andalucia/database/ciberpiso_andalucia.sqlite
```

On Windows, `py` instead of `python3`. The loader checks that each CSV has the columns of
its table, turns empty cells into NULL and validates the foreign keys.

## Open the database

- **With a GUI:** `sudo dnf install sqlitebrowser` and open the `.sqlite` of the copy
  you want. Paste any block of `consultas.sql` into "Execute SQL".
- **Terminal:** `sqlite3 -header -column data/malaga/database/ciberpiso_malaga.sqlite`.
- **Python:** `sqlite3.connect("data/malaga/database/ciberpiso_malaga.sqlite")` with `pandas.read_sql`.

To get started, use the views `v_fincas` (each farm with municipality, climate and soil),
`v_candidatas` (the plots that fit the rainfed-farm case) and `v_precios`. In the
Andalucía copy, filter with `WHERE provincia = 29` (it has an index).

## Tables

| Table | One row per… | Key | Source |
| --- | --- | --- | --- |
| `dim_municipio` | municipality | `municipio_key` | SIGPAC (codes) |
| `dim_celda_power` | climate cell | `celda_power` | POWER |
| `fincas` | farm (SIGPAC plot) | `finca_key` | SIGPAC (geometry) + NASADEM + WorldCover + MODIS |
| `recintos` | SIGPAC enclosure | `recinto_key` | SIGPAC (geometry) |
| `suelo_fincas` | farm with soil data | `finca_key` | SoilGrids |
| `fenologia_fincas` | farm and season | `finca_key, campana` | MODIS NDVI |
| `ndvi_fincas` | farm and date | `finca_key, fecha` | MODIS NDVI |
| `clima_anual` | cell and season | `celda_power, campana` | POWER |
| `suelo_humedad_anual` | cell and season | `celda_power, campana` | POWER |
| `dim_producto_precio` | agricultural product | `producto_codigo` | Eurostat |
| `precios_anuales` | product and year (2000–2024) | `producto_codigo, anio` | Eurostat |
| `precios_veza` | year (2014–2024) | `anio` | MAPA, Anuario de Estadística |

A season (`campana`) runs from October of the previous year to September (2024 = Oct-2023
to Sep-2024). `finca_key` = province × 10⁸ + order, so it is the same in both copies.

## Crop catalogue and scenarios

- `data/crops.csv`: initial parameters for wheat, sunflower, chickpea, vetch and fallow,
  with the Eurostat product code when there is one. Vetch uses the national MAPA series
  (`data/manual/precios_veza.csv`), not Eurostat.
- `python3 pipeline/prepare_inputs.py`: uses the Málaga copy and joins the 60 candidates
  with their climate, soil, phenology and prices for each season (2020–2025). It
  generates `data/processed/scenarios.csv` and `data/processed/scenarios_qa.json`. It is a
  working intermediate and is not versioned.
- `data/manual/precios_veza.csv`: national grain vetch series from MAPA (2014–2024),
  transcribed from table 7.2.7.2. Each row carries its source and URL; it was not
  downloaded automatically.
- `data/rotation_content.json`: explanatory sheets for each rotation (why, evidence,
  benefits, gaps and local review risks). It is versioned content.
- `python3 pipeline/calculator.py`: scores the four rotations per farm and generates
  `data/processed/indicators.json`, the source consumed by the web. That JSON is
  versioned; the rest of `data/processed/` is not. It accepts `--weights` and
  `--constraints` for custom priorities and constraints.
- `python3 pipeline/calibrate.py`: compares the rain-based water score with the water
  deficit one and validates by municipality. It writes `data/calibration.json`
  (versioned) and `data/processed/validation.json` (intermediate). The result is in
  [`docs/validacion.md`](../docs/validacion.md).
- `python3 pipeline/audit.py`: checks the five mandatory fields, the sources and units of
  each indicator, ties and the consistency of the rankings. It writes
  `data/processed/audit.json`.
- `python3 pipeline/export_app_indicators.py`: filters the 26 Antequera candidates and
  writes `app/public/data/indicators_antequera.json` for the web.

## Regenerate the CSVs from the sources

Only if the data has to be updated. It needs internet and the pipeline environment
(`pipeline/requirements.txt`); the complete steps are in `docs/fuentes-scraping.md`.

```bash
.venv/bin/python -m pipeline.build --ambito andalucia            # data/andalucia/csv/
.venv/bin/python -m pipeline.subconjunto --de andalucia --a malaga   # data/malaga/csv/
```

## Git

The CSVs are pushed, so anyone who clones the repo has the data. The `.sqlite` files are
not: they exceed the 100 MB that GitHub accepts, and they are generated from the CSVs with
the command above.
