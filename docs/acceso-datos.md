# Acceso a datos: recetas verificadas

Comandos y patrones para descargar las fuentes del reto sin perder tiempo en
autenticación, formatos y unidades. Todo lo marcado como verificado se probó el
**14 de noviembre de 2026**.

## Reglas

1. **Nada de secretos en el repo.** Usa variables de entorno o `~/.netrc`.
2. **Cachea antes de la demo.** Una API en vivo es un punto de fallo.
3. **Registra fuente, fecha, AOI y unidad** por cada archivo.
4. **No confundas visualización con dato.** GIBS sirve PNG; los valores salen del
   DAAC correspondiente.
5. **Si un endpoint falla, sigue con el MVP.** El reto no exige usar todas las
   fuentes.

## Estructura sugerida

```text
data/
  raw/
    power/2024-04-01_2024-09-30_42.03_-93.62.json
    ssurgo/aoi_42.03_-93.62.json
    nlcd/nlcd_2021_aoi.tif
  processed/
    indicators.json
    map.geojson
  manifest.json
```

---

## 1. NASA POWER (sin credenciales)

### curl

```bash
curl -sS -G 'https://power.larc.nasa.gov/api/temporal/daily/point' \
  --data-urlencode 'parameters=T2M,T2M_MIN,T2M_MAX,PRECTOTCORR,RH2M' \
  --data-urlencode 'community=AG' \
  --data-urlencode 'longitude=-93.62' \
  --data-urlencode 'latitude=42.03' \
  --data-urlencode 'start=20240401' \
  --data-urlencode 'end=20240930' \
  --data-urlencode 'format=JSON'
```

### Python

```python
import json
from pathlib import Path

import requests

params = {
    "parameters": "T2M,T2M_MIN,T2M_MAX,PRECTOTCORR,RH2M",
    "community": "AG",
    "longitude": -93.62,
    "latitude": 42.03,
    "start": "20240401",
    "end": "20240930",
    "format": "JSON",
}
r = requests.get(
    "https://power.larc.nasa.gov/api/temporal/daily/point",
    params=params,
    timeout=60,
)
r.raise_for_status()
data = r.json()["properties"]["parameter"]

# Cada variable es un dict {fecha: valor}. -999 significa sin dato.
out = Path("data/raw/power/season.json")
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
```

**Gotchas verificados:**

- Las fechas van como `20240401`, no `2024-04-01`. Con guiones devuelve 422.
- `T2M_MIN` y `T2M_MAX` son parámetros válidos.
- `PRECTOTCORR` viene en mm/día.
- El valor de relleno es `-999`; fíltralo antes de promediar.

---

## 2. SSURGO vía Soil Data Access (sin credenciales)

### curl mínimo

```bash
curl -sS -X POST 'https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest' \
  --data-urlencode "query=SELECT TOP 3 areasymbol, areaname FROM legend ORDER BY areasymbol" \
  --data-urlencode "format=JSON"
```

Respuesta verificada:

```json
{"Table":[["AK600","Matanuska-Susitna Valley Area, Alaska"],["AK605","Anchorage Area, Alaska"],["AK610","Greater Fairbanks Area, Alaska"]]}
```

### Python: componentes y horizontes en un punto

```python
import requests

sql = """
SELECT TOP 5 mu.mukey, mu.muname, c.compname, c.comppct_r,
       h.hzdept_r, h.hzdepb_r, h.claytotal_r, h.sandtotal_r, h.om_r, h.awc_r
FROM mapunit mu
JOIN component c ON c.mukey = mu.mukey
JOIN chorizon h ON h.cokey = c.cokey
WHERE mu.mukey IN (
  SELECT * FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('POINT(-93.62 42.03)')
)
"""

r = requests.post(
    "https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest",
    data={"query": sql, "format": "JSON"},
    timeout=60,
)
r.raise_for_status()
rows = r.json()["Table"]
print(rows[:2])
```

**Gotchas:**

- `SDA_Get_Mukey_from_intersection_with_WktWgs84` acepta un WKT en WGS84.
- El resultado es una lista de listas, sin nombres de columna. Lleva el orden del
  `SELECT`.
- `awc_r` es una fracción; comprueba la definición y la unidad en el diccionario
  SSURGO antes de multiplicar por profundidad.
- Para un AOI grande, usa el WKT del polígono o descarga el mosaico SSURGO completo.

---

## 3. USGS NWIS (sin credenciales)

```bash
curl -sS 'https://waterservices.usgs.gov/nwis/dv/?format=json&sites=05484500&parameterCd=00060&startDT=2024-01-01&endDT=2024-01-31'
```

```python
import requests

params = {
    "format": "json",
    "sites": "05484500",       # Raccoon River at Van Meter, IA
    "parameterCd": "00060",    # caudal, ft3/s
    "startDT": "2024-01-01",
    "endDT": "2024-01-31",
}
r = requests.get(
    "https://waterservices.usgs.gov/nwis/dv/",
    params=params,
    timeout=60,
)
r.raise_for_status()
data = r.json()

series = data["value"]["timeSeries"][0]["values"][0]["value"]
for row in series[:3]:
    print(row["dateTime"], row["value"])
```

**Gotchas:**

- `00060` es caudal en ft³/s; `00065` es nivel en ft. Convierte si usas unidades SI.
- Los datos provisionales pueden revisarse.
- La estación no representa toda la cuenca; úsala como contexto.

---

## 4. CMR: metadatos de productos NASA (sin credenciales)

```bash
curl -sS 'https://cmr.earthdata.nasa.gov/search/collections.json?keyword=SMAP&page_size=5'
```

```python
import requests

r = requests.get(
    "https://cmr.earthdata.nasa.gov/search/collections.json",
    params={"keyword": "SMAP", "page_size": 5},
    timeout=60,
)
r.raise_for_status()
for entry in r.json()["feed"]["entry"]:
    print(entry["entry_id"], "-", entry["title"])
```

**Uso:** encontrar el `short_name` y el DAAC correctos antes de descargar. CMR no
contiene los datos, solo el catálogo.

---

## 5. GIBS WMTS: teselas de visualización (sin credenciales)

### Descubrir capas

```bash
curl -sS 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml' \
  -o gibs.xml

grep -oE '<ows:Identifier>[^<]*(SMAP|IMERG|Land_Surface_Temp|GLDAS)[^<]*' gibs.xml \
  | sed 's/<ows:Identifier>//' | sort -u
```

### Plantilla de tesela

```text
https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{layer}/default/{date}/{tilematrixset}/{z}/{y}/{x}.png
```

Ejemplo verificado (Iowa, 1 de julio de 2024):

```text
https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/SMAP_L4_Analyzed_Surface_Soil_Moisture/default/2024-07-01/GoogleMapsCompatible_Level6/6/23/15.png
```

Capas verificadas:

- `SMAP_L4_Analyzed_Surface_Soil_Moisture`
- `IMERG_Precipitation_Rate`
- `IMERG_Precipitation_Rate_30min`
- `MODIS_Terra_Land_Surface_Temp_Day`
- `GLDAS_Underground_Soil_Moisture_Monthly`

**Gotchas:**

- El `tilematrixset` cambia según la capa (`Level6`, `Level7`). Léelo del XML.
- La fecha debe estar dentro del rango de la capa.
- Son PNG con una rampa de color: sirven para el mapa, no para calcular.

---

## 6. Earthdata Login (SMAP, IMERG, Landsat, GEDI...)

### Configurar `~/.netrc`

```text
machine urs.earthdata.nasa.gov
  login TU_USUARIO
  password TU_PASSWORD
```

```bash
chmod 600 ~/.netrc
```

No subas `.netrc` al repo. Añádelo a `.gitignore`.

### Buscar y descargar con `earthaccess`

```python
import earthaccess

earthaccess.login(strategy="netrc")

results = earthaccess.search_data(
    short_name="SPL4SMGP",             # SMAP L4 soil moisture
    bounding_box=(-94.0, 41.5, -93.0, 42.5),
    temporal=("2024-07-01", "2024-07-31"),
)
earthaccess.download(results, "data/raw/smap")
```

**Gotchas:**

- Empieza con un AOI y un mes, no con un año completo.
- Los archivos de SMAP/IMERG pueden ser grandes; revisa el tamaño antes de descargar.
- Para Landsat, el `short_name` y la colección cambian con el nivel de procesamiento;
  búscalo en CMR.
- AppEEARS es útil para ECOSTRESS, pero requiere login y tareas asíncronas; no lo
  uses en la demo en vivo.

---

## 7. Otras APIs con credenciales

### ERA5 (CDS)

`~/.cdsapirc`:

```text
url: https://cds.climate.copernicus.eu/api
key: TU_KEY
```

```python
import cdsapi

client = cdsapi.Client()
client.retrieve(
    "reanalysis-era5-single-levels",
    {
        "product_type": "reanalysis",
        "variable": ["2m_temperature", "total_precipitation"],
        "year": "2024",
        "month": "07",
        "day": "01",
        "time": "12:00",
        "area": [43, -95, 41, -92],  # N, W, S, E
        "format": "netcdf",
    },
    "data/raw/era5/2024-07-01.nc",
)
```

### Copernicus Sentinel-2

OAuth en [Copernicus Data Space](https://dataspace.copernicus.eu/). Usa el catálogo
OData o `sentinelhub`; no pongas el token en el cliente. Para el MVP, Landsat o
GIBS suelen ser suficientes.

### USDA QuickStats

```bash
curl -sS "https://quickstats.nass.usda.gov/api/api_GET/?key=${NASS_API_KEY}&commodity_desc=CORN&year=2023&format=JSON"
```

Sin key devuelve 401. Los datos son agregados por condado/estado.

### USDA AMS Market News

API MARS con key. La forma exacta de autenticación depende del endpoint; consulta la
documentación de MARS y guarda la key en `AMS_API_KEY`. Sin key devuelve 403.

### OpenET

API con key. Úsala solo si el caso de uso está en el oeste de EE. UU. y necesitas ET
a escala de campo.

---

## 8. Caché y manifiesto

Cada descarga debe dejar un registro:

```json
{
  "source": "NASA POWER",
  "url": "https://power.larc.nasa.gov/api/temporal/daily/point?...",
  "retrieved_at": "2026-11-14T10:06:00Z",
  "aoi": {"west": -94.0, "south": 41.5, "east": -93.0, "north": 42.5},
  "variable": ["T2M", "PRECTOTCORR"],
  "temporal": {"start": "2024-04-01", "end": "2024-09-30"},
  "file": "data/raw/power/season.json",
  "sha256": "..."
}
```

```bash
sha256sum data/raw/power/season.json
```

**Regla:** si no está en el manifiesto, no existe para la demo.

---

## 9. Armonización espacial y temporal

### Rejilla

- **Proyección:** `EPSG:5070` (NAD83 / Conus Albers) para Iowa. Es de áreas iguales.
- **Resolución:** 30 m para suelo, cobertura y pendiente; 250 m para clima agregado.
- **Regla:** agrega lo grueso hacia lo fino solo para visualizar. Para calcular, usa
  la resolución nativa del dato y documenta la agregación.

### Tiempo

- Define la temporada: 1 de abril – 30 de septiembre (ajústala al cultivo).
- Convierte todo a fecha ISO (`YYYY-MM-DD`) y a la zona horaria local.
- Si agregas a mensual, indica si es suma (lluvia) o media (temperatura).
- Maneja años bisiestos y días sin dato.

### Unidades

| Variable | Unidad típica | Cuidado |
| --- | --- | --- |
| Temperatura | °C | No mezclar con K |
| Lluvia | mm/día | Sumar, no promediar |
| Radiación | MJ/m²/día | Revisar si es W/m² |
| AWC | fracción | Comprobar cm/cm |
| Caudal | ft³/s | Convertir a m³/s si hace falta |
| Pendiente | % o grados | No mezclar |

### Nodata y calidad

- Filtra `-999` en POWER y el `nodata` de cada ráster.
- Calcula el porcentaje de cobertura del AOI.
- Si la cobertura es menor del 80 %, marca el indicador como de baja confianza.
- Guarda el número de píxeles válidos por indicador.

---

## 10. Validación mínima

1. **Lluvia:** compara POWER, PRISM y, si hay, CoCoRaHS para 3 fechas.
2. **Temperatura:** compara POWER con una estación cercana.
3. **Suelo:** contrasta SSURGO con Web Soil Survey para el mismo punto.
4. **Cultivo:** contrasta CDL con NAIP en 2–3 parcelas.
5. **NDVI:** comprueba que el pico coincide con el calendario de cultivo.

Documenta las diferencias en `docs/validacion.md`. Una discrepancia explicada vale
más que un número perfecto sin contexto.
