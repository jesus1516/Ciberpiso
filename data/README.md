# Datos de Ciberpiso

Fincas de la provincia de Málaga (363.401 parcelas SIGPAC) con clima, humedad del
suelo, relieve, cobertura, suelo y cultivo estimado por satélite. Las fuentes y sus
límites están en [`docs/fuentes-scraping.md`](../docs/fuentes-scraping.md).

```text
data/
├── csv/                  tablas finales, una por fichero (UTF-8, coma, punto decimal)
├── database/
│   ├── ciberpiso.sqlite  base de datos generada a partir de csv/
│   ├── schema.sql        tablas, claves, índices y vistas
│   └── consultas.sql     consultas de ejemplo listas para usar
├── manifest.json         registro de cada descarga (URL, fecha, tamaño, SHA-256)
├── raw/                  descargas originales (no se versiona)
└── processed/            intermedios del pipeline (no se versiona)
```

## Abrir la base de datos

- **Con interfaz:** `sudo dnf install sqlitebrowser` y abre
  `data/database/ciberpiso.sqlite`. Pega cualquier bloque de `consultas.sql` en
  "Ejecutar SQL".
- **Terminal:** `sqlite3 -header -column data/database/ciberpiso.sqlite`.
- **Python:** `sqlite3.connect("data/database/ciberpiso.sqlite")` con `pandas.read_sql`.

Para empezar, usa las vistas `v_fincas` (cada finca con municipio, clima y suelo) y
`v_candidatas` (las parcelas que encajan con el caso de la finca de secano).

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

Una campaña va de octubre del año anterior a septiembre (2024 = oct-2023 a sep-2024).

## Catálogo de cultivos y escenarios

- `data/crops.csv`: parámetros iniciales de trigo, girasol, garbanzo, veza y barbecho,
  con el código de producto Eurostat de cada uno. La veza no tiene serie de precio y
  se declara como hueco, sin imputar.
- `python3 pipeline/prepare_inputs.py`: cruza las 60 candidatas con su clima, suelo,
  fenología y precios de cada campaña (2020–2025). Genera
  `data/processed/scenarios.csv` y `data/processed/scenarios_qa.json`. Es un
  intermedio de trabajo y no se versiona.
- `python3 pipeline/calculator.py`: puntúa las cuatro rotaciones por finca y genera
  `data/processed/indicators.json`, la fuente que consume la web. Ese JSON sí se
  versiona; el resto de `data/processed/` no.

## Crear la base en cualquier equipo

Solo hace falta Python 3.8 o superior, sin instalar nada más. Desde la raíz del repo:

```bash
python3 pipeline/cargar_sqlite.py      # Linux y Mac
py pipeline\cargar_sqlite.py           # Windows
```

Tarda unos 10 segundos y crea `data/database/ciberpiso.sqlite` a partir de `data/csv/`
y `schema.sql`. Comprueba que cada CSV tiene las columnas de su tabla, convierte las
celdas vacías en NULL y valida las claves foráneas.

## Volver a descargar los datos desde las fuentes

Solo si hay que actualizar los CSV. Necesita internet y el entorno del pipeline
(`pipeline/requirements.txt`); los pasos están en `docs/fuentes-scraping.md`.

```bash
.venv/bin/python -m pipeline.build --provincias 29   # escribe data/csv/
```

## Git

Los CSV sí se suben, así que quien clone el repo tiene los datos. `ciberpiso.sqlite`
(≈270 MB) no: GitHub rechaza ficheros de más de 100 MB. Se genera desde los CSV en
segundos con `python -m pipeline.cargar_sqlite`.
