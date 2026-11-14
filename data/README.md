# Datos de Ciberpiso

Fincas SIGPAC con clima, humedad del suelo, relieve, cobertura, suelo, cultivo estimado
por satélite y precios. Hay **dos copias independientes**, cada una con sus CSV y su
base de datos:

| Copia | Provincias | Fincas | CSV | Base SQLite |
| --- | --- | --- | --- | --- |
| `malaga/` | 29 Málaga | 363.401 | ~180 MB | ~275 MB |
| `andalucia/` | las 8 de Andalucía | 2.909.040 | ~1,4 GB | ~2,2 GB |

La copia de Málaga es exactamente la parte de Málaga de la de Andalucía (mismas claves y
mismas filas). Las fuentes y sus límites están en
[`docs/fuentes-scraping.md`](../docs/fuentes-scraping.md).

```text
data/
├── malaga/
│   ├── csv/
│   │   ├── comun/              clima, humedad del suelo, celdas de clima y precios
│   │   └── 29_malaga/          fincas, recintos, suelo, fenología, NDVI y municipios
│   └── database/
│       ├── ciberpiso_malaga.sqlite   (se genera; no se sube a git)
│       ├── schema.sql          tablas, claves, índices y vistas
│       └── consultas.sql       16 consultas de ejemplo
├── andalucia/
│   ├── csv/
│   │   ├── comun/
│   │   ├── 04_almeria/  11_cadiz/  14_cordoba/  18_granada/
│   │   └── 21_huelva/   23_jaen/   29_malaga/   41_sevilla/
│   └── database/
│       ├── ciberpiso_andalucia.sqlite   (se genera; no se sube a git)
│       ├── schema.sql
│       └── consultas.sql
├── manual/precios_veza.csv     serie de veza del MAPA transcrita a mano (se copia a cada csv/comun/)
├── crops.csv, rotation_content.json, calibration.json   catálogo y contenido de la calculadora
├── manifest.json               registro de cada descarga (URL, fecha, tamaño, SHA-256)
├── raw/                        descargas originales (no se versiona)
└── processed/                  intermedios del pipeline (no se versiona)
```

`schema.sql` y `consultas.sql` son iguales en las dos copias; su fuente única está en
`pipeline/sql/`.

## Crear la base en cualquier equipo

Solo hace falta Python 3.8 o superior, sin instalar nada más. Desde la raíz del repo:

```bash
python3 pipeline/cargar_sqlite.py malaga       # ~10 s  -> data/malaga/database/ciberpiso_malaga.sqlite
python3 pipeline/cargar_sqlite.py andalucia    # ~70 s  -> data/andalucia/database/ciberpiso_andalucia.sqlite
```

En Windows, `py` en lugar de `python3`. El cargador comprueba que cada CSV tiene las
columnas de su tabla, convierte las celdas vacías en NULL y valida las claves foráneas.

## Abrir la base de datos

- **Con interfaz:** `sudo dnf install sqlitebrowser` y abre el `.sqlite` de la copia
  que quieras. Pega cualquier bloque de `consultas.sql` en "Ejecutar SQL".
- **Terminal:** `sqlite3 -header -column data/malaga/database/ciberpiso_malaga.sqlite`.
- **Python:** `sqlite3.connect("data/malaga/database/ciberpiso_malaga.sqlite")` con `pandas.read_sql`.

Para empezar, usa las vistas `v_fincas` (cada finca con municipio, clima y suelo),
`v_candidatas` (las parcelas que encajan con el caso de la finca de secano) y
`v_precios`. En la copia de Andalucía, filtra con `WHERE provincia = 29` (tiene índice).

## Tablas

| Tabla | Una fila por… | Clave | Fuente |
| --- | --- | --- | --- |
| `dim_municipio` | municipio | `municipio_key` | SIGPAC (códigos) |
| `dim_celda_power` | celda de clima | `celda_power` | NASA POWER |
| `fincas` | finca (parcela SIGPAC) | `finca_key` | SIGPAC (geometría) + NASADEM + WorldCover + MODIS |
| `recintos` | recinto SIGPAC | `recinto_key` | SIGPAC (geometría) |
| `suelo_fincas` | finca con dato de suelo | `finca_key` | SoilGrids |
| `fenologia_fincas` | finca y campaña | `finca_key, campana` | MODIS NDVI |
| `ndvi_fincas` | finca y fecha | `finca_key, fecha` | MODIS NDVI |
| `clima_anual` | celda y campaña | `celda_power, campana` | NASA POWER |
| `suelo_humedad_anual` | celda y campaña | `celda_power, campana` | NASA POWER |
| `dim_producto_precio` | producto agrario | `producto_codigo` | Eurostat |
| `precios_anuales` | producto y año (2000–2024) | `producto_codigo, anio` | Eurostat |
| `precios_veza` | año (2014–2024) | `anio` | MAPA, Anuario de Estadística |

Una campaña va de octubre del año anterior a septiembre (2024 = oct-2023 a sep-2024).
`finca_key` = provincia × 10⁸ + orden, así que es la misma en las dos copias.

## Catálogo de cultivos y escenarios

- `data/crops.csv`: parámetros iniciales de trigo, girasol, garbanzo, veza y barbecho,
  con el código de producto Eurostat cuando existe. La veza usa la serie nacional del
  MAPA (`data/manual/precios_veza.csv`), no Eurostat.
- `python3 pipeline/prepare_inputs.py`: usa la copia de Málaga y cruza las 60 candidatas con su clima, suelo,
  fenología y precios de cada campaña (2020–2025). Genera
  `data/processed/scenarios.csv` y `data/processed/scenarios_qa.json`. Es un
  intermedio de trabajo y no se versiona.
- `data/manual/precios_veza.csv`: serie nacional de veza grano del MAPA (2014–2024),
  transcrita de la tabla 7.2.7.2. Cada fila lleva fuente y URL; no se descargó
  automáticamente.
- `data/rotation_content.json`: fichas explicativas de cada rotación (por qué,
  evidencia, beneficios, lagunas y riesgos de revisión local). Es contenido versionado.
- `python3 pipeline/calculator.py`: puntúa las cuatro rotaciones por finca y genera
  `data/processed/indicators.json`, la fuente que consume la web. Ese JSON sí se
  versiona; el resto de `data/processed/` no. Acepta `--weights` y `--constraints`
  para prioridades y restricciones propias.
- `python3 pipeline/calibrate.py`: compara la nota de agua de lluvia con la de déficit
  hídrico y valida por municipios. Escribe `data/calibration.json` (versionado) y
  `data/processed/validation.json` (intermedio). El resultado está en
  [`docs/validacion.md`](../docs/validacion.md).
- `python3 pipeline/audit.py`: comprueba los cinco campos obligatorios, las fuentes y
  unidades de cada indicador, los empates y la coherencia de los rankings. Escribe
  `data/processed/audit.json`.
- `python3 pipeline/export_app_indicators.py`: filtra las 26 candidatas de Antequera y
  escribe `app/public/data/indicators_antequera.json` para la web.

## Volver a generar los CSV desde las fuentes

Solo si hay que actualizar los datos. Necesita internet y el entorno del pipeline
(`pipeline/requirements.txt`); los pasos completos están en `docs/fuentes-scraping.md`.

```bash
.venv/bin/python -m pipeline.build --ambito andalucia            # data/andalucia/csv/
.venv/bin/python -m pipeline.subconjunto --de andalucia --a malaga   # data/malaga/csv/
```

## Git

Los CSV se suben, así que quien clone el repo tiene los datos. Los `.sqlite` no:
superan los 100 MB que admite GitHub, y se generan desde los CSV con el comando de arriba.
