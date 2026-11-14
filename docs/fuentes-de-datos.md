# Data sources: what each one offers

Catalogue of the **26 official sources** in the Resources tab of the challenge, plus
two additional sources that appear in the challenge text or can be deduced from it.
For each one: what it provides, how it is used in the challenge, how to access it and
what its limit is.

> Verification: 14 November 2026. Access statuses may change.
> Do not put keys or credentials in the repository.

## Quick map

| # | Source | What it solves | Access |
| --- | --- | --- | --- |
| 1 | SMAP | Soil moisture and freeze/thaw | Earthdata |
| 2 | GPM / IMERG | Global rainfall | Earthdata |
| 3 | Landsat | Reflectance and NDVI at 30 m | USGS/Earthdata |
| 4 | MODIS | Daily vegetation indices and LST | Earthdata |
| 5 | VIIRS | Vegetation, fire and LST | Earthdata |
| 6 | POWER | Daily climate per point | Open |
| 7 | SRTM | Elevation and slope | Earthdata |
| 8 | ECOSTRESS | LST and ET at ~70 m | Earthdata |
| 9 | Ag Data Commons | Catalogue of agricultural data | Open |
| 10 | Web Soil Survey | Official soils per AOI | Manual |
| 11 | CDL / CropScape | Annual crop at 30 m | Web/bulk |
| 12 | PRISM | Local US climate | Open |
| 13 | SSURGO / STATSGO2 | Soil attributes | Open SDA |
| 14 | NAIP | 1 m aerial imagery | Open |
| 15 | NLCD | Land cover 30 m | Open |
| 16 | NLDAS / GLDAS | Continuous land series | Earthdata |
| 17 | GAEZ | Global agro-climatic suitability | Registration |
| 18 | CoCoRaHS | Citizen rainfall | Open |
| 19 | NWIS | Streamflow and groundwater | Open |
| 20 | AMS Market News | Prices and market | API key |
| 21 | QuickStats | Yield and area | API key |
| 22 | OpenET | Field-scale ET | API key |
| 23 | LANDFIRE | Vegetation and fuel | Open |
| 24 | GEDI | Canopy height and biomass | Earthdata |
| 25 | Sentinel-2 | Multispectral 10–20 m | OAuth |
| 26 | ERA5 | Global hourly reanalysis | CDS key |
| + | GRACE / GRACE-FO | Stored water | Earthdata |
| + | GIBS | Visualisation tiles | Open |

---

## Climate and atmosphere

### 6. POWER

**What it offers:** daily and monthly agroclimatology per point: mean, minimum and
maximum temperature, relative humidity, corrected precipitation, radiation, wind and
dew point. MERRA-2 source and POWER models, resolution 0.5° × 0.625°.

**Use in the challenge:** season rainfall, heat days, frosts, degree-days, radiation
and a simplified water balance. It is the easiest source for the MVP.

**Access:** open REST API, no key. Returns JSON or CSV.

**Limit:** it is a modelled product, not a local station. Do not promise plot
precision. Dates use the `YYYYMMDD` format.

### 2. GPM / IMERG

**What it offers:** global precipitation at 0.1°, every 30 minutes and daily totals.
It combines the GPM Core Observatory with a constellation of satellites.

**Use in the challenge:** rainfall intensity, torrentiality, erosion risk and
comparison with POWER/PRISM.

**Access:** Earthdata Login (GES DISC). Visualisation layers are in GIBS.

**Limit:** satellite rainfall has uncertainty and bias; validate with rain gauges
(CoCoRaHS) before claiming local extremes.

### 12. PRISM

**What it offers:** US climate with topographic effect: 30-year normals at 800 m and
daily/monthly series at 4 km. Precipitation, temperature, frosts.

**Use in the challenge:** local cross-check with POWER and climate context of the
county.

**Access:** open download; some products require registration.

**Limit:** US only; the daily series is 4 km, not 800 m.

### 26. ERA5 (ECMWF/Copernicus)

**What it offers:** global hourly reanalysis since 1940 at 0.25°: temperature,
precipitation, wind, humidity and radiation.

**Use in the challenge:** fill gaps, build historical scenarios and compare trends
outside the US.

**Access:** CDS API key (`~/.cdsapirc`).

**Limit:** modelled and coarse-scale; it does not replace a station.

### 16. NLDAS / GLDAS

**What it offers:** land data assimilation: soil moisture, ET, precipitation,
radiation and temperature. NLDAS covers the US at 0.125° hourly; GLDAS is global at
0.25°.

**Use in the challenge:** continuous series to fill gaps and compare balances.

**Access:** Earthdata Login (GES DISC). Some monthly variables are in GIBS.

**Limit:** it is a model, not a direct observation.

---

## Soil, moisture and water

### 1. SMAP

**What it offers:** surface soil moisture, root-zone moisture (L4) and
freeze/thaw state. 9 km resolution in L4, 2–3 day revisit.

**Use in the challenge:** drought, infiltration and early signal of water stress.

**Access:** Earthdata Login (NSIDC DAAC). GIBS has visualisation layers
(`SMAP_L4_Analyzed_Surface_Soil_Moisture`, freeze/thaw).

**Limit:** 9 km and gaps; it is not plot resolution. Do not use a GIBS PNG as if it
were a moisture value.

### 13. SSURGO / STATSGO2

**What it offers:** official soil attributes at field and regional scale: texture,
organic matter, hydrologic group, drainage, water holding capacity, erosion and
suitability.

**Use in the challenge:** soil baseline, water retention and runoff risk.

**Access:** Soil Data Access (SDA), SQL via POST, no key. Verified.

**Limit:** US only; they are soil-map polygons, not field samples. Check the units of
each field in the SSURGO dictionary.

### 10. Web Soil Survey

**What it offers:** official web interface to delimit an AOI and query soil maps and
properties, with downloadable reports.

**Use in the challenge:** manual exploration and SSURGO validation.

**Access:** web, manual export.

**Limit:** it is not an API; to automate use SSURGO/SDA. US only.

### 19. USGS NWIS

**What it offers:** streamflow, groundwater level, water quality and daily data from
US stations.

**Use in the challenge:** basin context, water availability and downstream stress.

**Access:** open JSON REST API. Verified.

**Limit:** it measures at the station, not at the plot; provisional data may change.

### 22. OpenET

**What it offers:** field-scale evapotranspiration (≈30 m) from Landsat and
Sentinel-2, with several models.

**Use in the challenge:** water demand and irrigation efficiency.

**Access:** API key; there is also a web explorer.

**Limit:** western US only; it is an ensemble of models, not a direct measurement.

### 8. ECOSTRESS

**What it offers:** surface temperature and evapotranspiration at ~70 m from the ISS.

**Use in the challenge:** heat-stress hotspots and field-scale water demand.

**Access:** Earthdata Login / AppEEARS.

**Limit:** irregular revisit and limited coverage; there is no complete daily series.

### + GRACE / GRACE-FO

**What it offers:** total stored water anomalies (soil, surface water, snow and
groundwater) in ~0.5° mascons, monthly.

**Use in the challenge:** long-term stored water trends and regional context.

**Access:** PO.DAAC / JPL, Earthdata Login. The challenge text cites it without its
own link.

**Limit:** very coarse and monthly resolution; it is not useful for a plot.

---

## Vegetation, crop and cover

### 3. Landsat

**What it offers:** multispectral reflectance at 30 m, 16-day revisit (Landsat 8/9),
NDVI, vegetation indices, temperature and land-cover change.

**Use in the challenge:** vegetation condition, bare soil, plot boundaries and
historical series.

**Access:** USGS EarthExplorer / Earthdata Login.

**Limit:** cloudiness and revisit; a 30 m pixel may mix crop and track.

### 4. MODIS

**What it offers:** vegetation indices, LST and cover at 250–1000 m, daily and 8/16-day
composites.

**Use in the challenge:** phenology, drought and heat stress at regional scale.

**Access:** LP DAAC / Earthdata Login. GIBS has daily LST layers.

**Limit:** coarse resolution; composites can hide short events.

### 5. VIIRS

**What it offers:** vegetation indices, LST, active fire and night lights at 375–750 m.

**Use in the challenge:** complement to MODIS and fire or drought context.

**Access:** LP DAAC / Earthdata Login.

**Limit:** similar to MODIS; not suitable for plot decisions.

### 11. CDL / CropScape

**What it offers:** annual crop classification at 30 m for the US, since 2008.

**Use in the challenge:** reconstruct the current rotation, measure diversity and
detect bare soil.

**Access:** CropScape web and bulk download. The SOAP service is alive but fragile;
do not put it on the critical path of the demo.

**Limit:** US only; classification errors, and it does not tell management or variety.

### 14. NAIP

**What it offers:** 1 m aerial photography in the growing season, on a 2–3 year cycle.

**Use in the challenge:** plot boundaries, bare soil, visual validation and context.

**Access:** USDA ArcGIS Hub, open.

**Limit:** it is not daily or multispectral for analysis; it is imagery.

### 15. NLCD

**What it offers:** 30 m land cover, multi-decadal, with impervious surfaces and
canopy.

**Use in the challenge:** microclimate context, baseline and cover change.

**Access:** MRLC, open download.

**Limit:** US only; general classes, not specific crops.

### 24. GEDI

**What it offers:** spaceborne lidar for canopy height, LAI and biomass (L4).

**Use in the challenge:** woody cover, windbreaks and carbon; context, not crops.

**Access:** ORNL DAAC / Earthdata Login. Link in the Resources tab:
<https://gedi.umd.edu/data>.

**Limit:** swath sampling, not wall-to-wall; it is not for cropland.

### 23. LANDFIRE

**What it offers:** vegetation type and condition, fuel and disturbances at 30 m.

**Use in the challenge:** perennial cover and fire context; useful at edges and
non-agricultural areas.

**Access:** open download.

**Limit:** US only; it does not describe agricultural management.

### 25. Sentinel-2 (ESA)

**What it offers:** multispectral at 10–20 m, 5-day revisit with two satellites,
red-edge, NIR and SWIR bands; NDVI/EVI.

**Use in the challenge:** global alternative to Landsat, better resolution and
frequency.

**Access:** Copernicus Data Space, OAuth.

**Limit:** cloudiness; there is not always an analysis-ready product.

---

## Agricultural context, validation and market

### 9. USDA Ag Data Commons

**What it offers:** catalogue and datasets on agriculture: soils, crops, management,
phenology and water quality.

**Use in the challenge:** local context, validation and management data that are not
in the satellite.

**Access:** open; some datasets require registration.

**Limit:** heterogeneous formats and licences; review each dataset.

### 17. FAO GAEZ

**What it offers:** global agro-ecological zones, crop suitability, soil/climate
constraints and yield potential.

**Use in the challenge:** global alternative when CDL/SSURGO do not apply.

**Access:** registration and download.

**Limit:** static and coarse-scale; it is not a plot recommendation.

### 18. CoCoRaHS

**What it offers:** daily precipitation from volunteer observers, with maps and
series.

**Use in the challenge:** validate IMERG/POWER and detect local extremes.

**Access:** open web.

**Limit:** volunteer network, irregular coverage; variable quality.

### 20. USDA AMS Market News

**What it offers:** prices, supply and demand of agricultural and livestock products.

**Use in the challenge:** market viability of the proposed rotation.

**Access:** MARS API with key; open web reports.

**Limit:** variable coverage; it is not a price forecast.

### 21. USDA NASS QuickStats

**What it offers:** yield, planted area, production and prices by county and state.

**Use in the challenge:** productivity baseline and market context.

**Access:** API key; open web query.

**Limit:** aggregated data; no plot or management.

---

## Visualisation

### + GIBS

**What it offers:** WMTS service with image tiles from the space agency: MODIS LST,
IMERG, SMAP L4, GLDAS and many more.

**Use in the challenge:** base map, overlays and visual storytelling of the demo.

**Access:** open WMTS, no key. Verified.

**Limit:** the tiles are PNGs with a colour ramp; **they are not quantitative data**.
To compute, use the DAAC product, not the PNG.

> **Verified correction:** GIBS does have SMAP L4, IMERG and GLDAS layers, in addition
> to MODIS LST. The initial research said there was no SMAP/IMERG; that was incorrect.
> What does not change is that they are images for visualising, not for extracting
> values.

---

## Which source to use for each question

| Question | Main source | Alternative |
| --- | --- | --- |
| How much does it rain in the season? | POWER | PRISM, IMERG |
| Is there frost risk? | POWER | PRISM |
| How much water can the soil hold? | SSURGO | WSS |
| What crop was there before? | CDL | NAIP |
| Is there plant stress? | Landsat/MODIS NDVI | Sentinel-2 |
| Is there extreme heat? | POWER | MODIS LST, ECOSTRESS |
| Is there surface water? | NWIS | GRACE |
| What market does it have? | QuickStats/AMS | Farmer input |
| Where does it show on the map? | GIBS | NAIP |

## Shortlists

### If there are only 2 hours

POWER + SSURGO (SDA) + NLCD + GIBS. With that you can make a map, a soil profile and
a basic climate comparison.

### If there is a day

Add CDL, PRISM, NWIS and SRTM. You can now reconstruct the current rotation,
cross-check climate and compute slope.

### If there is an Earthdata Login

Add SMAP, IMERG and Landsat. Use them for moisture, heavy rain and NDVI. Cache the
AOI before the demo.

### If there is time left

ECOSTRESS, GEDI, GRACE, OpenET, QuickStats and AMS. They are valuable, but each one
adds authentication, latency or uncertainty.

## Endpoint verification (2026-11-14)

| Endpoint | Result |
| --- | --- |
| `power.larc.nasa.gov/api/temporal/daily/point` | 200 JSON, no key |
| `cmr.earthdata.nasa.gov/search/collections.json` | 200, no key |
| `gibs.earthdata.nasa.gov/.../WMTSCapabilities.xml` | 200, ~5.8 MB |
| GIBS SMAP L4 tile | 200 PNG |
| GIBS IMERG tile | 200 PNG |
| GIBS MODIS LST tile | 200 PNG |
| GIBS GLDAS tile | 200 PNG |
| `waterservices.usgs.gov/nwis/dv/?format=json` | 200 JSON |
| `sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest` | 200 JSON with query |
| `appeears.earthdatacloud.nasa.gov/api/` | 200; login for tasks |
| `nassgeodata.gmu.edu/axis2/services/CDLService` | Alive; fragile SOAP |
| `quickstats.nass.usda.gov/api/api_GET` | 401 without key |
| `marsapi.ams.usda.gov/services/v1.2/reports` | 403 without key |
| `openet-api.org` | 200 docs; key for data |

## Common mistakes

- **Confusing resolution with accuracy.** A 30 m pixel does not guarantee 30 m of
  accuracy.
- **Using GIBS as data.** It is a coloured image; do not read values from the PNG.
- **Mixing units.** mm/day with mm/month, °C with K, fraction with percentage.
- **Comparing modelled ET with a field measurement** without saying so.
- **Promising plot scale with SMAP (9 km) or POWER (0.5°).**
- **Ignoring cloudiness and gaps.** A mean without coverage can lie.
- **Citing the source only in the README.** Each app card must carry a source and date.
