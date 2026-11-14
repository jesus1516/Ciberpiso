# Fuentes de datos: qué ofrece cada una

Catálogo de las **26 fuentes oficiales** de la pestaña Resources del reto, más dos
fuentes adicionales que aparecen en el enunciado o se deducen de él. Para cada una:
qué aporta, cómo se usa en el reto, cómo se accede y qué límite tiene.

> Verificación: 14 de noviembre de 2026. Los estados de acceso pueden cambiar.
> No metas claves ni credenciales en el repositorio.

## Mapa rápido

| # | Fuente | Qué resuelve | Acceso |
| --- | --- | --- | --- |
| 1 | SMAP | Humedad del suelo y freeze/thaw | Earthdata |
| 2 | GPM / IMERG | Lluvia global | Earthdata |
| 3 | Landsat | Reflectancia y NDVI a 30 m | USGS/Earthdata |
| 4 | MODIS | Índices de vegetación y LST diarios | Earthdata |
| 5 | VIIRS | Vegetación, fuego y LST | Earthdata |
| 6 | NASA POWER | Clima diario por punto | Abierto |
| 7 | SRTM | Elevación y pendiente | Earthdata |
| 8 | ECOSTRESS | LST y ET a ~70 m | Earthdata |
| 9 | Ag Data Commons | Catálogo de datos agrícolas | Abierto |
| 10 | Web Soil Survey | Suelos oficiales por AOI | Manual |
| 11 | CDL / CropScape | Cultivo anual a 30 m | Web/bulk |
| 12 | PRISM | Clima local de EE. UU. | Abierto |
| 13 | SSURGO / STATSGO2 | Atributos de suelo | SDA abierto |
| 14 | NAIP | Aérea 1 m | Abierto |
| 15 | NLCD | Cobertura del suelo 30 m | Abierto |
| 16 | NLDAS / GLDAS | Series continuas de tierra | Earthdata |
| 17 | GAEZ | Idoneidad agroclimática global | Registro |
| 18 | CoCoRaHS | Lluvia ciudadana | Abierto |
| 19 | NWIS | Caudal y agua subterránea | Abierto |
| 20 | AMS Market News | Precios y mercado | API key |
| 21 | QuickStats | Rendimiento y superficie | API key |
| 22 | OpenET | ET a escala de campo | API key |
| 23 | LANDFIRE | Vegetación y combustible | Abierto |
| 24 | GEDI | Altura de dosel y biomasa | Earthdata |
| 25 | Sentinel-2 | Multiespectral 10–20 m | OAuth |
| 26 | ERA5 | Reanálisis horario global | CDS key |
| + | GRACE / GRACE-FO | Agua almacenada | Earthdata |
| + | GIBS | Teselas de visualización | Abierto |

---

## Clima y atmósfera

### 6. NASA POWER

**Qué ofrece:** agroclimatología diaria y mensual por punto: temperatura media,
mínima y máxima, humedad relativa, precipitación corregida, radiación, viento y
punto de rocío. Fuente MERRA-2 y modelos POWER, resolución 0,5° × 0,625°.

**Uso en el reto:** lluvia de temporada, días de calor, heladas, grados-día,
radiación y balance hídrico simplificado. Es la fuente más fácil para el MVP.

**Acceso:** API REST abierta, sin clave. Devuelve JSON o CSV.

**Límite:** es un producto modelado, no una estación local. No prometas precisión de
parcela. Las fechas van en formato `AAAAMMDD`.

### 2. GPM / IMERG

**Qué ofrece:** precipitación global a 0,1°, cada 30 minutos y acumulados diarios.
Combina el GPM Core Observatory con una constelación de satélites.

**Uso en el reto:** intensidad de lluvia, torrencialidad, riesgo de erosión y
comparación con POWER/PRISM.

**Acceso:** Earthdata Login (GES DISC). Las capas de visualización están en GIBS.

**Límite:** la lluvia satelital tiene incertidumbre y sesgo; valida con pluviómetros
(CoCoRaHS) antes de afirmar extremos locales.

### 12. PRISM

**Qué ofrece:** clima de EE. UU. con efecto topográfico: normales de 30 años a 800 m
y series diarias/mensuales a 4 km. Precipitación, temperatura, heladas.

**Uso en el reto:** contraste local con POWER y contexto climático del condado.

**Acceso:** descarga abierta; algunos productos piden registro.

**Límite:** solo EE. UU.; la serie diaria es de 4 km, no de 800 m.

### 26. ERA5 (ECMWF/Copernicus)

**Qué ofrece:** reanálisis global horario desde 1940 a 0,25°: temperatura,
precipitación, viento, humedad y radiación.

**Uso en el reto:** rellenar huecos, construir escenarios históricos y comparar
tendencias fuera de EE. UU.

**Acceso:** CDS API key (`~/.cdsapirc`).

**Límite:** modelado y de escala gruesa; no sustituye una estación.

### 16. NLDAS / GLDAS

**Qué ofrece:** asimilación de datos de tierra: humedad del suelo, ET,
precipitación, radiación y temperatura. NLDAS cubre EE. UU. a 0,125° horario; GLDAS
es global a 0,25°.

**Uso en el reto:** series continuas para rellenar huecos y comparar balances.

**Acceso:** Earthdata Login (GES DISC). Algunas variables mensuales están en GIBS.

**Límite:** es un modelo, no una observación directa.

---

## Suelo, humedad y agua

### 1. SMAP

**Qué ofrece:** humedad superficial del suelo, humedad de zona radicular (L4) y
estado de congelación/descongelación. Resolución de 9 km en L4, revisita de 2–3 días.

**Uso en el reto:** sequía, infiltración y señal temprana de estrés hídrico.

**Acceso:** Earthdata Login (NSIDC DAAC). GIBS tiene capas de visualización
(`SMAP_L4_Analyzed_Surface_Soil_Moisture`, freeze/thaw).

**Límite:** 9 km y huecos; no es resolución de parcela. No uses un PNG de GIBS como
si fuera un valor de humedad.

### 13. SSURGO / STATSGO2

**Qué ofrece:** atributos oficiales de suelo a escala de campo y regional: textura,
materia orgánica, grupo hidrológico, drenaje, capacidad de retención de agua,
erosión y idoneidad.

**Uso en el reto:** línea base de suelo, retención de agua y riesgo de escorrentía.

**Acceso:** Soil Data Access (SDA), SQL vía POST, sin clave. Verificado.

**Límite:** solo EE. UU.; son polígonos de mapas de suelo, no muestras de campo.
Comprueba las unidades de cada campo en el diccionario SSURGO.

### 10. Web Soil Survey

**Qué ofrece:** interfaz web oficial para delimitar un AOI y consultar mapas y
propiedades de suelo, con informes descargables.

**Uso en el reto:** exploración manual y validación de SSURGO.

**Acceso:** web, exportación manual.

**Límite:** no es una API; para automatizar usa SSURGO/SDA. Solo EE. UU.

### 19. USGS NWIS

**Qué ofrece:** caudal, nivel de agua subterránea, calidad de agua y datos diarios
de estaciones de EE. UU.

**Uso en el reto:** contexto de cuenca, disponibilidad de agua y estrés aguas abajo.

**Acceso:** API REST JSON abierta. Verificado.

**Límite:** mide en la estación, no en la parcela; los datos provisionales pueden
cambiar.

### 22. OpenET

**Qué ofrece:** evapotranspiración a escala de campo (≈30 m) a partir de Landsat y
Sentinel-2, con varios modelos.

**Uso en el reto:** demanda hídrica y eficiencia de riego.

**Acceso:** API key; también hay explorador web.

**Límite:** solo oeste de EE. UU.; es un conjunto de modelos, no una medición directa.

### 8. ECOSTRESS

**Qué ofrece:** temperatura de superficie y evapotranspiración a ~70 m desde la ISS.

**Uso en el reto:** hotspots de estrés térmico y demanda de agua a escala de campo.

**Acceso:** Earthdata Login / AppEEARS.

**Límite:** revisita irregular y cobertura limitada; no hay serie diaria completa.

### + GRACE / GRACE-FO

**Qué ofrece:** anomalías de agua total almacenada (suelo, agua superficial,
nieve y subterránea) en mascons de ~0,5°, mensuales.

**Uso en el reto:** tendencias de agua almacenada a largo plazo y contexto regional.

**Acceso:** PO.DAAC / JPL, Earthdata Login. El enunciado lo cita sin enlace propio.

**Límite:** resolución muy gruesa y mensual; no sirve para una parcela.

---

## Vegetación, cultivo y cobertura

### 3. Landsat

**Qué ofrece:** reflectancia multiespectral a 30 m, revisita de 16 días (Landsat 8/9),
NDVI, índices de vegetación, temperatura y cambios de cobertura.

**Uso en el reto:** condición de la vegetación, suelo desnudo, límites de parcela y
series históricas.

**Acceso:** USGS EarthExplorer / Earthdata Login.

**Límite:** nubosidad y revisita; un píxel de 30 m puede mezclar cultivo y camino.

### 4. MODIS

**Qué ofrece:** índices de vegetación, LST y cobertura a 250–1000 m, diarios y
compuestos de 8/16 días.

**Uso en el reto:** fenología, sequía y estrés térmico a escala regional.

**Acceso:** LP DAAC / Earthdata Login. GIBS tiene capas diarias de LST.

**Límite:** resolución gruesa; los compuestos pueden ocultar eventos cortos.

### 5. VIIRS

**Qué ofrece:** índices de vegetación, LST, fuego activo y luces nocturnas a 375–750 m.

**Uso en el reto:** complemento de MODIS y contexto de incendios o sequía.

**Acceso:** LP DAAC / Earthdata Login.

**Límite:** similar a MODIS; no es adecuado para decisiones de parcela.

### 11. CDL / CropScape

**Qué ofrece:** clasificación anual de cultivo a 30 m para EE. UU., desde 2008.

**Uso en el reto:** reconstruir la rotación actual, medir diversidad y detectar suelo
desnudo.

**Acceso:** web de CropScape y descarga masiva. El servicio SOAP está vivo pero es
frágil; no lo pongas en la ruta crítica de la demo.

**Límite:** solo EE. UU.; errores de clasificación y no dice manejo ni variedad.

### 14. NAIP

**Qué ofrece:** fotografía aérea de 1 m en época de cultivo, con ciclo de 2–3 años.

**Uso en el reto:** límites de parcela, suelo desnudo, validación visual y contexto.

**Acceso:** USDA ArcGIS Hub, abierto.

**Límite:** no es diaria ni multiespectral para análisis; es imagery.

### 15. NLCD

**Qué ofrece:** cobertura del suelo a 30 m, multidecadal, con impervious y dosel.

**Uso en el reto:** contexto de microclima, línea base y cambio de cobertura.

**Acceso:** MRLC, descarga abierta.

**Límite:** solo EE. UU.; clases generales, no cultivo específico.

### 24. GEDI

**Qué ofrece:** lidar espacial para altura de dosel, LAI y biomasa (L4).

**Uso en el reto:** cobertura leñosa, cortavientos y carbono; contexto, no cultivo.

**Acceso:** ORNL DAAC / Earthdata Login. Enlace en la pestaña Resources:
<https://gedi.umd.edu/data>.

**Límite:** muestreo por franjas, no pared a pared; no es para campos de cultivo.

### 23. LANDFIRE

**Qué ofrece:** tipo y condición de vegetación, combustible y perturbaciones a 30 m.

**Uso en el reto:** cobertura perenne y contexto de fuego; útil en bordes y zonas no
agrícolas.

**Acceso:** descarga abierta.

**Límite:** solo EE. UU.; no describe manejo agrícola.

### 25. Sentinel-2 (ESA)

**Qué ofrece:** multiespectral a 10–20 m, 5 días de revisita con dos satélites,
bandas red-edge, NIR y SWIR; NDVI/EVI.

**Uso en el reto:** alternativa global a Landsat, mejor resolución y frecuencia.

**Acceso:** Copernicus Data Space, OAuth.

**Límite:** nubosidad; no siempre hay producto listo para análisis.

---

## Contexto agrícola, validación y mercado

### 9. USDA Ag Data Commons

**Qué ofrece:** catálogo y conjuntos de datos agrícolas: suelos, cultivos, manejo,
fenología y calidad de agua.

**Uso en el reto:** contexto local, validación y datos de manejo que no están en el
satélite.

**Acceso:** abierto; algunos conjuntos piden registro.

**Límite:** formatos y licencias heterogéneos; revisa cada dataset.

### 17. FAO GAEZ

**Qué ofrece:** zonas agroecológicas globales, idoneidad de cultivos, restricciones
de suelo/clima y potencial de rendimiento.

**Uso en el reto:** alternativa global cuando CDL/SSURGO no aplican.

**Acceso:** registro y descarga.

**Límite:** estático y de escala gruesa; no es una recomendación de parcela.

### 18. CoCoRaHS

**Qué ofrece:** precipitación diaria de observadores voluntarios, con mapas y series.

**Uso en el reto:** validar IMERG/POWER y detectar extremos locales.

**Acceso:** web abierta.

**Límite:** red voluntaria, cobertura irregular; calidad variable.

### 20. USDA AMS Market News

**Qué ofrece:** precios, oferta y demanda de productos agrícolas y ganaderos.

**Uso en el reto:** viabilidad de mercado de la rotación propuesta.

**Acceso:** MARS API con key; informes web abiertos.

**Límite:** cobertura variable; no es una previsión de precios.

### 21. USDA NASS QuickStats

**Qué ofrece:** rendimiento, superficie plantada, producción y precios por condado y
estado.

**Uso en el reto:** línea base de productividad y contexto de mercado.

**Acceso:** API key; consulta web abierta.

**Límite:** datos agregados; no hay parcela ni manejo.

---

## Visualización

### + GIBS

**Qué ofrece:** servicio WMTS con teselas de imagen de NASA: MODIS LST, IMERG,
SMAP L4, GLDAS y muchas más.

**Uso en el reto:** mapa base, overlays y narración visual de la demo.

**Acceso:** WMTS abierto, sin clave. Verificado.

**Límite:** las teselas son PNG con una rampa de color; **no son datos
cuantitativos**. Para calcular usa el producto del DAAC, no el PNG.

> **Corrección verificada:** GIBS sí tiene capas de SMAP L4, IMERG y GLDAS, además de
> MODIS LST. La investigación inicial decía que no había SMAP/IMERG; era incorrecto.
> Lo que no cambia es que son imágenes para visualizar, no para extraer valores.

---

## Qué fuente usar para cada pregunta

| Pregunta | Fuente principal | Alternativa |
| --- | --- | --- |
| ¿Cuánto llueve en la temporada? | POWER | PRISM, IMERG |
| ¿Hay riesgo de helada? | POWER | PRISM |
| ¿Cuánta agua puede retener el suelo? | SSURGO | WSS |
| ¿Qué cultivo había antes? | CDL | NAIP |
| ¿Hay estrés vegetal? | Landsat/MODIS NDVI | Sentinel-2 |
| ¿Hace calor extremo? | POWER | MODIS LST, ECOSTRESS |
| ¿Hay agua superficial? | NWIS | GRACE |
| ¿Qué mercado tiene? | QuickStats/AMS | Input del agricultor |
| ¿Dónde se ve en el mapa? | GIBS | NAIP |

## Shortlists

### Si solo hay 2 horas

POWER + SSURGO (SDA) + NLCD + GIBS. Con eso puedes hacer un mapa, un perfil de suelo
y una comparación climática básica.

### Si hay un día

Añade CDL, PRISM, NWIS y SRTM. Ya puedes reconstruir la rotación actual, contrastar
clima y calcular pendiente.

### Si hay Earthdata Login

Añade SMAP, IMERG y Landsat. Úsalos para humedad, lluvia intensa y NDVI. Cachea el
AOI antes de la demo.

### Si sobra tiempo

ECOSTRESS, GEDI, GRACE, OpenET, QuickStats y AMS. Son valiosos, pero cada uno añade
autenticación, latencia o incertidumbre.

## Verificación de endpoints (2026-11-14)

| Endpoint | Resultado |
| --- | --- |
| `power.larc.nasa.gov/api/temporal/daily/point` | 200 JSON, sin clave |
| `cmr.earthdata.nasa.gov/search/collections.json` | 200, sin clave |
| `gibs.earthdata.nasa.gov/.../WMTSCapabilities.xml` | 200, ~5,8 MB |
| Tesela GIBS SMAP L4 | 200 PNG |
| Tesela GIBS IMERG | 200 PNG |
| Tesela GIBS MODIS LST | 200 PNG |
| Tesela GIBS GLDAS | 200 PNG |
| `waterservices.usgs.gov/nwis/dv/?format=json` | 200 JSON |
| `sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest` | 200 JSON con consulta |
| `appeears.earthdatacloud.nasa.gov/api/` | 200; login para tareas |
| `nassgeodata.gmu.edu/axis2/services/CDLService` | Vivo; SOAP frágil |
| `quickstats.nass.usda.gov/api/api_GET` | 401 sin key |
| `marsapi.ams.usda.gov/services/v1.2/reports` | 403 sin key |
| `openet-api.org` | 200 docs; key para datos |

## Errores comunes

- **Confundir resolución con precisión.** Un píxel de 30 m no garantiza 30 m de
  exactitud.
- **Usar GIBS como dato.** Es una imagen coloreada; no leas valores del PNG.
- **Mezclar unidades.** mm/día con mm/mes, °C con K, fracción con porcentaje.
- **Comparar ET modelada con una medición de campo** sin decirlo.
- **Prometer escala de parcela con SMAP (9 km) o POWER (0,5°).**
- **Ignorar nubosidad y huecos.** Una media sin cobertura puede mentir.
- **Citar la fuente solo en el README.** Cada tarjeta de la app debe llevar fuente y
  fecha.
