# Fuentes scrapeadas: España (Málaga)

> Registro vivo de las fuentes que usa el pipeline `pipeline/`. **Regla del equipo:
> todos los datos de las fincas salen de fuentes de [`resources.md`](../resources.md).**
>
> Última actualización: 14 de noviembre de 2026. Ámbito: **provincia de Málaga (29)**.
> Antequera es el municipio SIGPAC **15** (`municipio_key = 29015`).

## Resumen

| Dato por finca | Fuente | ¿En `resources.md`? | Tabla CSV |
| --- | --- | --- | --- |
| Clima diario 2001–2025 → indicadores por campaña | **NASA POWER** | ✅ #6–7 | `clima_anual`, `dim_celda_power` |
| Humedad del suelo (superficial, radicular, perfil) | **NASA POWER** (MERRA-2) | ✅ #6–7 | `suelo_humedad_anual` |
| Altitud y pendiente | **SRTM** (versión NASA NASADEM) vía Planetary Computer | ✅ #28 (y SRTM, #3–4) | `fincas` |
| Textura, carbono, pH y agua disponible del suelo | **ISRIC SoilGrids 2.0** | ⚠️ excepción aprobada | `suelo_fincas` |
| Cobertura del suelo (% cultivo, arbolado, pasto…) | **ESA WorldCover 2021** vía Planetary Computer | ✅ #28 | `fincas` |
| Vegetación y cultivo estimado por campaña | **NASA MODIS MOD13Q1** (LP DAAC) vía Planetary Computer | ✅ #4, #28 | `fenologia_fincas`, `ndvi_fincas`, `fincas` |
| Dónde está cada finca (identificador y polígono) | SIGPAC recintos 2026 (FEGA) | ❌ (ver nota) | `fincas`, `recintos`, `dim_municipio` |

**Nota sobre SIGPAC.** Ninguna fuente de `resources.md` delimita fincas en España, así
que SIGPAC se usa **solo como esqueleto**: código de parcela/recinto, municipio y
polígono. **No se usa ningún atributo temático de SIGPAC** (uso, pendiente, altitud,
regadío ni cultivo declarado). Todo lo que describe la finca sale de las fuentes de la
tabla anterior.

**Nota sobre SoilGrids.** El equipo trabaja con **SoilGrids + SRTM**. SoilGrids no
está en `resources.md`, pero el plan de acción ya lo fijaba como sustituto de SSURGO
(que solo cubre EE. UU.), así que entra como **única excepción explícita**. SRTM sí está
en la lista; se usa su versión reprocesada por NASA (NASADEM), con los mismos datos
radar de 2000, huecos rellenados y mejor calibración.

## 1. Revisión de `resources.md`, enlace a enlace

| # | Enlace | Fuente | ¿Cubre España? | Uso en el pipeline | Estado |
| --- | --- | --- | --- | --- | --- |
| 1 | earthdata…/smap | SMAP | Sí (9 km) | Requiere Earthdata Login; humedad del suelo sale de POWER | 🔑 |
| 2 | gpm.nasa.gov/data | GPM / IMERG | Sí (0,1°) | Lluvia sale de POWER; IMERG está también en Planetary Computer (`gpm-imerg-hhr`) | ⏸️ |
| 3 | earthexplorer.usgs.gov | Landsat / SRTM | Sí | Relieve con NASADEM (SRTM reprocesado) vía #28 | ✅ (vía #28) |
| 4 | earthdata…/lp-daac | MODIS / VIIRS (LP DAAC) | Sí (250 m) | **MOD13Q1 NDVI** vía Planetary Computer | ✅ |
| 5 | search.earthdata…VIIRS | VIIRS | Sí | No necesario (MODIS cubre la serie) | ⏸️ |
| 6–7 | power.larc.nasa.gov | **NASA POWER** | Sí (0,5°×0,625°) | Clima y humedad del suelo por celda | ✅ |
| 8 | ecostress.jpl.nasa.gov | ECOSTRESS | Sí (~70 m) | Requiere Earthdata/AppEEARS | 🔑 |
| 9–11 | nal.usda.gov/…agdatacommons | Ag Data Commons | No | — | ⛔ |
| 12 | prism.oregonstate.edu | PRISM | No | — | ⛔ |
| 13 | nrcs.usda.gov/…/soils | SSURGO / NRCS | No | Sustituto: **SoilGrids** (excepción aprobada) | ⛔ |
| 14 | naip-usdaonline… | NAIP | No | — | ⛔ |
| 15 | usgs.gov/…/nlcd | NLCD | No | Cobertura con WorldCover (#28) | ⛔ |
| 16–17 | earthdata.nasa.gov | Portal Earthdata | — | Login y catálogo | ➖ |
| 18 | cocorahs.org | CoCoRaHS | No | — | ⛔ |
| 19 | waterdata.usgs.gov | NWIS | No | — | ⛔ |
| 20 | ams.usda.gov/market-news | AMS Market News | No (EE. UU.) | **Sin precios para España** | ⛔ |
| 21 | quickstats.nass.usda.gov | NASS QuickStats | No (EE. UU.) | Sin rendimientos para España | ⛔ |
| 22 | etdata.org | OpenET | No | ET0 calculada con POWER | ⛔ |
| 23 | landfire.gov | LANDFIRE | No | — | ⛔ |
| 24 | gedi.umd.edu | GEDI | Sí | Requiere Earthdata; poco útil en cultivo | 🔑 |
| 25 | earthdata…/lp-daac | (repetido de #4) | — | — | — |
| 26 | spaceapps.earth | Web del evento | — | — | ➖ |
| 27 | meteomatics.com | Meteomatics | Sí | API con cuenta; no necesaria | ⏸️ |
| 28 | planetarycomputer.microsoft.com | **Planetary Computer** | Sí | NASADEM, WorldCover, MODIS (STAC anónimo) | ✅ |

Leyenda: ✅ usado · 🔑 requiere credenciales que no tenemos · ⏸️ disponible, no
necesario · ⛔ solo EE. UU. · ➖ no es un dataset.

## 2. Detalle por fuente

### 2.1 NASA POWER (`pipeline/power.py`)

- **Endpoint:** `https://power.larc.nasa.gov/api/temporal/daily/point`, `community=AG`,
  sin clave. Serie diaria **2001-01-01 → 2025-12-31**.
- **Parámetros:** `PRECTOTCORR, T2M, T2M_MAX, T2M_MIN, TOA_SW_DWN, ALLSKY_SFC_SW_DWN,
  GWETTOP, GWETROOT, GWETPROF, RH2M, WS2M`.
- **Rejilla:** MERRA-2, 0,5° lat × 0,625° lon. Se pide una vez por celda (10 celdas en
  Málaga), no por finca. `celda_power = round((lat+90)/0,5)*1000 + round((lon+180)/0,625)`.
- **Indicadores por campaña** (octubre del año anterior a septiembre): lluvia total y
  de octubre a mayo, ET0 de Hargreaves-Samani (Ra = `TOA_SW_DWN` × 0,408), déficit
  hídrico, días con Tmax ≥ 32 °C en mayo–junio (llenado del grano) y ≥ 35 °C en
  julio–agosto (girasol), heladas totales y tardías, humedad del suelo media, de
  primavera, de siembra y su anomalía.
- **Gotchas verificados:**
  - En las series `climatology` y `monthly`, `T2M_MAX`/`T2M_MIN` son **extremos**,
    no medias. Por eso se usa la serie diaria.
  - `GWETROOT` de MERRA-2 en Málaga no baja de ~0,46: un umbral fijo de "suelo seco"
    no sirve. Se usa la **anomalía** respecto a la media de la celda.
  - Las celdas costeras (lat 36,5) mezclan mar y tierra: ET0 y calor bajos.
- **Validación rápida:** celda de Antequera (37,0, −4,375): 453 mm/año de media,
  331 mm en año seco (p20), campañas más secas 2005 y 2014, sequía 2023 con 302 mm y
  anomalía de humedad −0,07.

### 2.2 Planetary Computer (`pipeline/pc.py`)

- **Catálogo:** `https://planetarycomputer.microsoft.com/api/stac/v1`, acceso anónimo
  con firma SAS (`planetary_computer.sign`).
- **Rejilla de análisis:** 1/4000° (~28 m N–S × 22 m E–O), alineada a grados enteros.
  Las fincas se rasterizan en ella y cada variable se promedia con todos sus píxeles.
  Las fincas sin píxel propio (muy pequeñas) toman el píxel de su centroide.

| Colección | Producto | Uso |
| --- | --- | --- |
| `nasadem` | NASA NASADEM, 1" | `altitud_m` (media) y `pendiente_pct` (gradiente en la rejilla) |
| `esa-worldcover` | WorldCover 2021 v200, 10 m | `wc_*_pct`: fracción exacta de 3×3 píxeles por celda de análisis |
| `modis-13Q1-061` | MOD13Q1 v6.1 (Terra), 250 m, 16 días | NDVI 2019-10 → 2025-06 (130 compuestos, tesela h17v05) |

- **NDVI:** escala 0,0001; se descartan píxeles con `pixel_reliability` distinto de
  0 (bueno) o 1 (marginal). Fecha = inicio del compuesto + 8 días.
- **Gotchas verificados:**
  - El catálogo tiene **varias versiones del mismo compuesto** (reprocesados; p. ej.
    `A2021257` aparece 3 veces). Se deduplica por `AYYYYDDD` quedándose con la
    producción más reciente.
  - En Planetary Computer, MOD13Q1 **termina en `A2025177`** (finales de junio de
    2025): la campaña 2025 no tiene julio–septiembre.
- **Clase de cultivo estimada por campaña.** Umbrales calibrados en Málaga con fincas
  de ≥ 80 % de una sola clase WorldCover (medianas):

| NDVI mediano | Cultivo | Pasto | Arbolado |
| --- | --- | --- | --- |
| Verano (jun–ago) | 0,26 | 0,31 | 0,42 |
| Amplitud (p90−p10) | 0,33 | 0,24 | 0,16 |
| Otoño (oct–dic) | ~0,27 (siembra tardía) | ~0,40 | ~0,52 |

| Clase | Regla (se aplica en este orden) | Letra en `rotacion_estimada` |
| --- | --- | --- |
| `sin_datos` | < 12 compuestos válidos | `?` |
| `sin_vegetacion` | NDVI máx < 0,25 | `S` |
| `herbaceo_verano` | pico en mayo–agosto, máx − ene–abr ≥ 0,12 y jun–ago ≥ ene–abr (girasol) | `V` |
| `herbaceo_invierno` | pico en feb–may, amplitud ≥ 0,25, jun–ago ≤ 0,33 y máx − oct–dic ≥ 0,25 (cereal, leguminosa) | `I` |
| `permanente` | amplitud < 0,2 y jun–ago ≥ 0,33 (arbolado, matorral, olivar denso) | `P` |
| `barbecho_o_pastizal` | jun–ago < 0,4 (en finca de cultivo: barbecho o cosecha débil) | `B` |
| `mixto` | resto | `M` |

- **Comprobación contra WorldCover** (fincas ≥ 2,5 ha): cultivo → 56 % `I` + 38 % `B`;
  pasto → 70 % `B`; arbolado → 53 % `P`; matorral → 61 % `P`. Confusión conocida: el
  olivar abierto con cubierta vegetal se parece a pasto (`B`).

### 2.3 SIGPAC, solo esqueleto (`pipeline/sigpac.py`)

- **Descarga:** `https://sigpac-hubcloud.es/geopackages/2026/recintos/29_MALAGA_rec_2026_20251215_gpkg.zip`
  (403 MB; CC BY 4.0, autor FEGA). Toda España: 50 ficheros, 34,5 GB.
- **Columnas leídas:** `provincia, municipio, agregado, zona, poligono, parcela,
  recinto` y la geometría (para el área y para rasterizar). Nada más.
- **Málaga:** 969.034 recintos en 363.401 fincas (parcelas).
- **Gotcha:** el GeoPackage está en EPSG:4258; los centroides se calculan en
  EPSG:25830 (en Canarias, EPSG:4083).

### 2.4 SoilGrids 2.0, ISRIC (`pipeline/soilgrids.py`, excepción aprobada)

- **Endpoint:** `https://maps.isric.org/mapserv?map=/map/{prop}.map` (WCS 2.0.1, sin
  clave, CC BY 4.0). Un recorte por propiedad y profundidad para el bbox de la
  provincia (35 peticiones en Málaga, 8 MB).
- **Propiedades:** arcilla, arena, carbono orgánico y elementos gruesos de 0 a 100 cm;
  limo, pH, densidad, nitrógeno y CIC de 0 a 30 cm.
- **Cálculo:** se muestrea el centroide de cada recinto y se promedia por finca
  ponderando por superficie. Salidas: media 0–30 cm y **agua disponible 0–100 cm**
  (`cad_0_100_mm`), estimada con Saxton & Rawls (2006) descontando los gruesos.
- **Gotcha verificado:** el recorte debe pedirse en la proyección nativa (Homolosine,
  `+proj=igh`) con `SUBSET=X(...)&SUBSET=Y(...)`. Con `SUBSETTINGSRS=EPSG:4326`
  responde 404 `InvalidSubsetting`.
- **Unidades de origen:** arcilla, arena y limo en g/kg (÷10 → %); carbono en dg/kg
  (÷10 → g/kg); pH ×10; densidad en cg/cm³ (÷100); nitrógeno en cg/kg (÷100); CIC en
  mmol(c)/kg (÷10).
- **Resultado:** 356.481 de 363.401 fincas con dato (el resto, agua o urbano). En la
  Campiña de Antequera: ~32 % arcilla, pH 7,8–7,9, carbono ~14 g/kg, ~130 mm de agua
  disponible.
- **Límite:** resolución de 250 m y modelo estadístico global. En la media provincial
  el carbono (~22 g/kg) parece alto para suelos agrícolas andaluces: úsalo para
  comparar fincas, no como análisis de laboratorio.

## 3. Modelo de datos (CSV → SQLite)

Ficheros en `data/csv/`, UTF-8, coma, punto decimal, `NULL` = celda vacía,
ordenados por clave primaria. Claves enteras para JOIN rápidos; el código SIGPAC
(`parcela_id`, `recinto_id`) es el identificador estable entre versiones.

| Tabla | Grano (una fila por…) | Clave primaria | Fuente |
| --- | --- | --- | --- |
| `dim_municipio` | municipio | `municipio_key` | Esqueleto |
| `dim_celda_power` | celda MERRA-2 | `celda_power` | NASA POWER |
| `fincas` | parcela SIGPAC | `finca_key` | Esqueleto + NASADEM + WorldCover + MODIS |
| `recintos` | recinto SIGPAC | `recinto_key` | Esqueleto |
| `suelo_fincas` | finca con dato de suelo | `finca_key` | SoilGrids |
| `fenologia_fincas` | finca × campaña (fincas ≥ 2 ha) | `finca_key, campana` | MODIS |
| `ndvi_fincas` | finca × compuesto de 16 días (fincas ≥ 10 ha con ≥ 50 % cultivo) | `finca_key, fecha` | MODIS |
| `clima_anual` | celda × campaña | `celda_power, campana` | NASA POWER |
| `suelo_humedad_anual` | celda × campaña | `celda_power, campana` | NASA POWER |

- **Esquema** con claves foráneas, índices y vistas (`v_fincas`, `v_candidatas`,
  `v_clima_suelo_anual`): [`data/database/schema.sql`](../data/database/schema.sql); consultas de ejemplo en [`data/database/consultas.sql`](../data/database/consultas.sql).
- **Base de datos:** `python -m pipeline.cargar_sqlite` genera
  `data/database/ciberpiso.sqlite` **a partir de los CSV**, comprueba que las columnas
  coinciden con el esquema y valida las claves foráneas.
- **Tamaños (Málaga):** `fincas` 363.401 filas (57 MB), `recintos` 969.034 (67 MB),
  `suelo_fincas` 356.481 (26 MB), `fenologia_fincas` 296.238 (21 MB), `ndvi_fincas`
  201.292 (6 MB), `clima_anual` y `suelo_humedad_anual` 240 cada una. SQLite: 269 MB.
- **Acceso:** las consultas típicas (fincas de un municipio, finca por código SIGPAC,
  serie NDVI de una finca, fenología + clima + humedad de una finca) usan índice o
  clave primaria y tardan < 1 ms.
- **Candidatas** (`es_candidata = 1`): parcela ≥ 50 ha, ≥ 60 % cultivo (WorldCover),
  pendiente ≤ 12 %, ≥ 5 de 6 campañas arables (`I`, `V` o `B`) con al menos una `I`, y
  sin señal de regadío estival (NDVI jun–ago < 0,55). **Resultado: 60 en Málaga, 26 en
  Antequera**, todas en la Campiña (Antequera, Campillos, Teba, Fuente de Piedra,
  Sierra de Yeguas). También en `data/processed/geo/fincas_candidatas.geojson`.
  - Por qué no 150–250 ha: el plan describe una *explotación* de 150–250 ha en 5–20
    parcelas. Sin el cultivo declarado de SIGPAC no se pueden agrupar parcelas en
    explotaciones, y en Antequera solo 2 parcelas sueltas de ese tamaño son de cultivo.
  - Ejemplo: `29:15:0:0:62:14` (96 ha, 99 % cultivo, pendiente 4 %) → `I-B-I-B-I-B`,
    cereal–barbecho "año y vez".

## 4. Cómo reproducirlo

```bash
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r pipeline/requirements.txt
.venv/bin/python -m pipeline.sigpac --provincias 29     # esqueleto de fincas
.venv/bin/python -m pipeline.power  --provincias 29     # clima y humedad del suelo
.venv/bin/python -m pipeline.pc     --provincias 29     # SRTM/NASADEM, WorldCover, MODIS
.venv/bin/python -m pipeline.soilgrids --provincias 29  # suelo (SoilGrids)
.venv/bin/python -m pipeline.build  --provincias 29     # CSV
.venv/bin/python -m pipeline.cargar_sqlite              # SQLite
```

Cada descarga queda registrada en `data/manifest.json` (URL o colección, fecha, tamaño
y SHA-256).

## 5. Ampliar a Andalucía

El pipeline ya acepta varias provincias: `--provincias 4,11,14,18,21,23,29,41`. Los
recintos de las 8 provincias pesan ~3,0 GB (2,6 GB nuevos, ~20 min a 2,4 MB/s); todas
caen en la tesela MODIS h17v05. NASA POWER necesitará unas 30–40 celdas.

## 6. Lagunas (por la regla "solo `resources.md`")

- **Precios:** las únicas fuentes de la lista (AMS, QuickStats) son de EE. UU. y
  requieren API key. No hay precios españoles.
- **Suelo:** la textura y la química vienen de SoilGrids (excepción aprobada, 250 m);
  la humedad, de POWER/MERRA-2 (~50 km). SMAP (9 km) necesitaría Earthdata Login.
- **Cultivo real:** el cultivo es una **estimación por NDVI** a 250 m, no el cultivo
  declarado. En fincas < 6 ha el píxel MODIS mezcla vecinos.
- **Secano/regadío:** no hay dato directo; solo la señal de NDVI estival.
- **Explotación (finca del agricultor con varias parcelas):** no se puede reconstruir
  sin el cultivo declarado de SIGPAC, que no está en `resources.md`.
- **Fuentes probadas y descartadas** por no estar en `resources.md`: SIGPAC cultivo
  declarado 2025 y precios de la API agroalimentaria de la Comisión Europea.
  Funcionaban; se pueden reactivar si el equipo cambia la regla.
