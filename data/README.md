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

Una campaña va de octubre del año anterior a septiembre (2024 = oct-2023 a sep-2024).

## Regenerar

```bash
.venv/bin/python -m pipeline.build --provincias 29   # escribe data/csv/
.venv/bin/python -m pipeline.cargar_sqlite           # escribe data/database/ciberpiso.sqlite
```

`cargar_sqlite` comprueba que cada CSV tiene las columnas de su tabla y que las claves
foráneas cuadran. El pipeline completo está en `docs/fuentes-scraping.md`.

## Git

Los CSV sí se suben, así que quien clone el repo tiene los datos. `ciberpiso.sqlite`
(≈270 MB) no: GitHub rechaza ficheros de más de 100 MB. Se genera desde los CSV en
segundos con `python -m pipeline.cargar_sqlite`.
