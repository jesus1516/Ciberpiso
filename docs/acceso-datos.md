# Data access: verified recipes

Commands and patterns to download the challenge sources without wasting time on
authentication, formats and units. Everything marked as verified was tested on
**14 November 2026**.

## Rules

1. **No secrets in the repo.** Use environment variables or `~/.netrc`.
2. **Cache before the demo.** A live API is a point of failure.
3. **Record source, date, AOI and unit** for every file.
4. **Do not confuse visualisation with data.** GIBS serves PNG; the values come from
   the corresponding DAAC.
5. **If an endpoint fails, carry on with the MVP.** The challenge does not require
   using every source.

## Suggested structure

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

## 1. POWER (no credentials)

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

# Each variable is a {date: value} dict. -999 means no data.
out = Path("data/raw/power/season.json")
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
```

**Verified gotchas:**

- Dates go as `20240401`, not `2024-04-01`. With hyphens it returns 422.
- `T2M_MIN` and `T2M_MAX` are valid parameters.
- `PRECTOTCORR` comes in mm/day.
- The fill value is `-999`; filter it before averaging.

---

## 2. SSURGO via Soil Data Access (no credentials)

### Minimal curl

```bash
curl -sS -X POST 'https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest' \
  --data-urlencode "query=SELECT TOP 3 areasymbol, areaname FROM legend ORDER BY areasymbol" \
  --data-urlencode "format=JSON"
```

Verified response:

```json
{"Table":[["AK600","Matanuska-Susitna Valley Area, Alaska"],["AK605","Anchorage Area, Alaska"],["AK610","Greater Fairbanks Area, Alaska"]]}
```

### Python: components and horizons at a point

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

- `SDA_Get_Mukey_from_intersection_with_WktWgs84` accepts a WKT in WGS84.
- The result is a list of lists, without column names. It follows the order of the
  `SELECT`.
- `awc_r` is a fraction; check the definition and unit in the SSURGO dictionary before
  multiplying by depth.
- For a large AOI, use the polygon's WKT or download the complete SSURGO mosaic.

---

## 3. USGS NWIS (no credentials)

```bash
curl -sS 'https://waterservices.usgs.gov/nwis/dv/?format=json&sites=05484500&parameterCd=00060&startDT=2024-01-01&endDT=2024-01-31'
```

```python
import requests

params = {
    "format": "json",
    "sites": "05484500",       # Raccoon River at Van Meter, IA
    "parameterCd": "00060",    # discharge, ft3/s
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

- `00060` is discharge in ft³/s; `00065` is level in ft. Convert if you use SI units.
- Provisional data may be revised.
- The station does not represent the whole basin; use it as context.

---

## 4. CMR: product metadata (no credentials)

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

**Use:** find the right `short_name` and DAAC before downloading. CMR does not hold the
data, only the catalogue.

---

## 5. GIBS WMTS: visualisation tiles (no credentials)

### Discover layers

```bash
curl -sS 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml' \
  -o gibs.xml

grep -oE '<ows:Identifier>[^<]*(SMAP|IMERG|Land_Surface_Temp|GLDAS)[^<]*' gibs.xml \
  | sed 's/<ows:Identifier>//' | sort -u
```

### Tile template

```text
https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{layer}/default/{date}/{tilematrixset}/{z}/{y}/{x}.png
```

Verified example (Iowa, 1 July 2024):

```text
https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/SMAP_L4_Analyzed_Surface_Soil_Moisture/default/2024-07-01/GoogleMapsCompatible_Level6/6/23/15.png
```

Verified layers:

- `SMAP_L4_Analyzed_Surface_Soil_Moisture`
- `IMERG_Precipitation_Rate`
- `IMERG_Precipitation_Rate_30min`
- `MODIS_Terra_Land_Surface_Temp_Day`
- `GLDAS_Underground_Soil_Moisture_Monthly`

**Gotchas:**

- The `tilematrixset` changes depending on the layer (`Level6`, `Level7`). Read it
  from the XML.
- The date must be within the layer's range.
- They are PNGs with a colour ramp: good for the map, not for computing.

---

## 6. Earthdata Login (SMAP, IMERG, Landsat, GEDI...)

### Configure `~/.netrc`

```text
machine urs.earthdata.nasa.gov
  login YOUR_USER
  password YOUR_PASSWORD
```

```bash
chmod 600 ~/.netrc
```

Do not commit `.netrc` to the repo. Add it to `.gitignore`.

### Search and download with `earthaccess`

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

- Start with one AOI and one month, not a whole year.
- SMAP/IMERG files can be large; check the size before downloading.
- For Landsat, the `short_name` and the collection change with the processing level;
  look it up in CMR.
- AppEEARS is useful for ECOSTRESS, but it requires login and asynchronous tasks; do
  not use it in the live demo.

---

## 7. Other APIs with credentials

### ERA5 (CDS)

`~/.cdsapirc`:

```text
url: https://cds.climate.copernicus.eu/api
key: YOUR_KEY
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

OAuth at [Copernicus Data Space](https://dataspace.copernicus.eu/). Use the OData
catalogue or `sentinelhub`; do not put the token in the client. For the MVP, Landsat
or GIBS are usually enough.

### USDA QuickStats

```bash
curl -sS "https://quickstats.nass.usda.gov/api/api_GET/?key=${NASS_API_KEY}&commodity_desc=CORN&year=2023&format=JSON"
```

Without a key it returns 401. The data are aggregated by county/state.

### USDA AMS Market News

MARS API with a key. The exact form of authentication depends on the endpoint; see
the MARS documentation and store the key in `AMS_API_KEY`. Without a key it returns
403.

### OpenET

API with a key. Use it only if the use case is in the western US and you need
field-scale ET.

---

## 8. Cache and manifest

Every download must leave a record:

```json
{
  "source": "POWER",
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

**Rule:** if it is not in the manifest, it does not exist for the demo.

---

## 9. Spatial and temporal harmonisation

### Grid

- **Projection:** `EPSG:5070` (NAD83 / Conus Albers) for Iowa. It is equal-area.
- **Resolution:** 30 m for soil, cover and slope; 250 m for aggregated climate.
- **Rule:** aggregate the coarse towards the fine only for visualisation. For
  computing, use the data's native resolution and document the aggregation.

### Time

- Define the season: 1 April – 30 September (adjust it to the crop).
- Convert everything to ISO dates (`YYYY-MM-DD`) and to the local time zone.
- If you aggregate to monthly, state whether it is a sum (rain) or a mean
  (temperature).
- Handle leap years and days without data.

### Units

| Variable | Typical unit | Caution |
| --- | --- | --- |
| Temperature | °C | Do not mix with K |
| Rain | mm/day | Sum, do not average |
| Radiation | MJ/m²/day | Check whether it is W/m² |
| AWC | fraction | Check cm/cm |
| Discharge | ft³/s | Convert to m³/s if needed |
| Slope | % or degrees | Do not mix |

### Nodata and quality

- Filter `-999` in POWER and the `nodata` of each raster.
- Compute the AOI coverage percentage.
- If coverage is below 80%, mark the indicator as low confidence.
- Store the number of valid pixels per indicator.

---

## 10. Minimum validation

1. **Rain:** compare POWER, PRISM and, if available, CoCoRaHS for 3 dates.
2. **Temperature:** compare POWER with a nearby station.
3. **Soil:** check SSURGO against Web Soil Survey for the same point.
4. **Crop:** check CDL against NAIP on 2–3 plots.
5. **NDVI:** check that the peak matches the crop calendar.

Document the differences in `docs/validacion.md`. An explained discrepancy is worth
more than a perfect number without context.
