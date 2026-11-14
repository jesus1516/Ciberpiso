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
| Precios agrarios de venta en España, anuales 2000–2024 | **Eurostat** `apri_ap_crpouta` | ⚠️ excepción aprobada | `precios_anuales`, `dim_producto_precio` |
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
| 20 | ams.usda.gov/market-news | AMS Market News | No (EE. UU.) | Sustituto: **Eurostat** (excepción aprobada) | ⛔ |
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

### 2.5 Precios, Eurostat (`pipeline/precios.py`, excepción aprobada)

- **Endpoint:** `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/apri_ap_crpouta?geo=ES&currency=EUR`
  (JSON-stat, sin clave). "Selling prices of crop products": precio medio anual de
  venta en España que el Ministerio de Agricultura comunica a Eurostat.
- **Contenido:** 87 productos y 1.901 precios de 2000 a 2024 (8 provisionales, marca
  `p`). Para el caso: trigo blando y duro, cebada, avena, triticale, girasol, guisante,
  haba, lenteja, garbanzo, aceituna y aceite. `precio_eur` va en la unidad de Eurostat
  (casi siempre 100 kg) y `precio_eur_t` en €/t.
- **Medias 2015–2024 (€/t):** garbanzo 756, girasol 401, trigo duro 288, guisante 250,
  trigo blando 213, cebada 199. El pico de 2022 (trigo blando 342 €/t) refleja la guerra
  de Ucrania.
- **Primera opción descartada:** la API semanal por mercado de la Comisión Europea
  (`api.tech.ec.europa.eu/agrifood/api/cereal/prices`) devolvía error 500 el 14-11-2026,
  incluso con los ejemplos de su documentación. Si vuelve, daría precios semanales por
  lonja.
- **Límites:** precio nacional y anual, no de la Campiña ni de la semana de venta.
  Eurostat no incluye veza; para eso está la serie del MAPA de 2.6. No es una previsión.

### 2.6 Precio de veza, MAPA (excepción aprobada)

- **Fuente:** MAPA, Anuario de Estadística 2025, tabla 7.2.7.2 "Veza. Serie histórica
  de superficie, rendimiento, producción, precio y valor". Precio medio anual
  percibido por el agricultor, nacional, en €/100 kg.
- **URL:** `https://www.mapa.gob.es/estadistica/pags/anuario/2025/FORMATO%20PDF/AE25-C07/7.2.7.2.pdf`
- **Contenido:** 2014–2024. 2024 = 48,79 €/100 kg = 487,9 €/t. Se guarda en
  `data/manual/precios_veza.csv` (se copia a cada `csv/comun/`) y se cruza por campaña en `prepare_inputs.py`.
- **Por qué no Eurostat:** la nomenclatura europea no incluye veza grano; sí incluye
  guisante, haba, garbanzo y altramuces. No se usa un proxy.
- **Límites:** precio nacional y anual, no de lonja; no hay precio provincial. La
  campaña 2025 usa 2024 como referencia. Para veza forrajera en verde, el Anuario
  publica otra tabla (7.6.3.5.1) que no es comparable con grano.
- **Fuente complementaria:** lonjas andaluzas (Junta de Andalucía), veza grano en Jaén
  (490 €/t en las semanas 37–38 de 2026), coherente con el orden de magnitud del MAPA.

## 3. Modelo de datos (CSV → SQLite)

Dos copias, `data/malaga/` y `data/andalucia/`, cada una con `csv/comun/`, `csv/<pp_provincia>/` (una carpeta por provincia) y `database/`. UTF-8, coma, punto decimal, `NULL` = celda vacía,
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
| `dim_producto_precio` | producto agrario | `producto_codigo` | Eurostat |
| `precios_anuales` | producto × año | `producto_codigo, anio` | Eurostat |
| `precios_veza` | año | `anio` | MAPA (transcrito) |

- **Esquema** con claves foráneas, índices y vistas (`v_fincas`, `v_candidatas`,
  `v_clima_suelo_anual`): [`pipeline/sql/schema.sql`](../pipeline/sql/schema.sql) (se copia a cada `data/<copia>/database/`); consultas de ejemplo en [`pipeline/sql/consultas.sql`](../pipeline/sql/consultas.sql).
- **Base de datos:** `python3 pipeline/cargar_sqlite.py malaga|andalucia` genera
  `data/<copia>/database/ciberpiso_<copia>.sqlite` **a partir de los CSV**, comprueba que las columnas
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
.venv/bin/python -m pipeline.sigpac --provincias 4,11,14,18,21,23,29,41 --borrar-zip  # esqueleto
.venv/bin/python -m pipeline.power  --provincias 4,11,14,18,21,23,29,41   # clima y humedad
.venv/bin/python -m pipeline.pc     --provincias 4,11,14,18,21,23,29,41   # SRTM, WorldCover, MODIS
.venv/bin/python -m pipeline.soilgrids --provincias 4,11,14,18,21,23,29,41  # suelo
.venv/bin/python -m pipeline.precios                    # precios (Eurostat)
.venv/bin/python -m pipeline.build --ambito andalucia              # CSV de Andalucía
.venv/bin/python -m pipeline.subconjunto --de andalucia --a malaga  # copia de Málaga
python3 pipeline/cargar_sqlite.py andalucia                          # SQLite (y malaga)
```

Cada descarga queda registrada en `data/manifest.json` (URL o colección, fecha, tamaño
y SHA-256).

## 5. Andalucía (8 provincias)

Mismo pipeline, `--provincias 4,11,14,18,21,23,29,41`. Ejecutado el 14-11-2026 en ~1 h
(descarga de SIGPAC 25 min; Planetary Computer 35 min).

| Provincia | Fincas | Superficie, ha | % cultivo | Candidatas |
| --- | --- | --- | --- | --- |
| 04 Almería | 487.398 | 876.613 | 4,7 | 6 |
| 11 Cádiz | 96.831 | 743.329 | 29,1 | 581 |
| 14 Córdoba | 342.866 | 1.376.610 | 17,3 | 617 |
| 18 Granada | 590.259 | 1.263.818 | 13,9 | 78 |
| 21 Huelva | 183.922 | 1.013.163 | 7,9 | 66 |
| 23 Jaén | 629.141 | 1.348.134 | 4,8 | 34 |
| 29 Málaga | 363.401 | 730.474 | 12,2 | 60 |
| 41 Sevilla | 215.222 | 1.404.648 | 35,7 | 1.294 |
| **Total** | **2.909.040** | **8.756.789** | | **2.736** |

- 6.817.265 recintos; 47 celdas de NASA POWER; base SQLite de 2,2 GB generada desde los
  CSV en ~70 s.
- CSV en una carpeta por provincia (`data/andalucia/csv/<pp_provincia>/`); el mayor es
  `23_jaen/fincas.csv` con 97 MiB, justo por debajo del límite de 100 MiB de GitHub.
- **Avisos al leer la clase de cultivo fuera de Málaga:** los umbrales de NDVI se
  calibraron en Málaga. En Almería, los invernaderos cuentan como cultivo en WorldCover
  pero dan NDVI bajo (`sin_vegetacion`); en el altiplano de Granada pasa algo parecido
  con el cereal de secano muy pobre. Jaén tiene poco "cultivo" porque WorldCover
  clasifica casi todo el olivar como arbolado.
- Para ahorrar disco, `pipeline.sigpac --borrar-zip` borra cada zip tras extraerlo, y
  los GeoPackages se pueden borrar tras `pipeline.pc` (el GeoJSON de candidatas solo
  incluye las provincias cuyo GeoPackage siga en disco).

## 6. Lagunas (por la regla "solo `resources.md`")

- **Precios:** solo nacionales y anuales (Eurostat); sin precio local de lonja ni de veza.
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
