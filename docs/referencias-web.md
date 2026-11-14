# Referencias para la web de Ciberpiso

> Nota de inspiración y apoyo técnico para la app de Ciberpiso. No son dependencias obligatorias: es una lista curada de mapas, datos, texturas, repositorios y patrones que pueden mejorar la web. Última revisión: **2026-11-14**.

> **Ojo:** la app actual **no usa Google Maps**. Usa **Esri World Imagery** para el satélite, **Mapzen Terrarium** para el terreno y **NASA GIBS** para las capas opcionales. Estas referencias son para mejorar o sustituir piezas con criterio, no para añadirlas todas.

## Cómo usar esta nota

| Si quieres... | Mira... |
|---|---|
| Un mapa 3D desde arriba con relieve | MapLibre 3D Terrain + Mapzen/Copernicus DEM |
| Resaltar provincias o municipios al pasar el ratón | MapLibre hover + feature-state (sección 2) |
| Entrar en Málaga/Antequera con una animación | MapLibre flyTo + overlay (sección 2) |
| Un diorama low-poly de la finca | React Three Fiber + drei (sección 3) |
| Texturas y assets 3D gratis | Poly Haven, AmbientCG, Kenney, Quaternius (sección 4) |
| Límites de Andalucía, provincias y municipios | IGN CNIG, IECA DERA, es-atlas (sección 1) |
| Fincas y cultivos reales | SIGPAC OGC API (sección 1) |
| Clima, suelo y precios | NASA POWER, SoilGrids, AEMET, Eurostat/MAPA (sección 1) |
| UI tipo glassmorphism | Tailwind + Radix/shadcn + Motion (sección 5) |
| Agentes que trabajan de noche | Magrathea, amux, voundbrand/overnight (sección 6) |

---

## 1. Mapas, límites y geodatos

### 1.1. Andalucía, provincias y municipios

| Recurso | URL | Para qué | Nota |
|---|---|---|---|
| IGN CNIG — Límites municipales, provinciales y autonómicos | https://centrodedescargas.cnig.es/CentroDescargas/limites-municipales-provinciales-autonomicos | Límites oficiales de España en SHP/GPKG/GML y WFS | Atribución IGN; precisión ~40 m |
| IECA DERA — Datos Espaciales de Referencia de Andalucía | https://www.juntadeandalucia.es/institutodeestadisticaycartografia/dega/datos-espaciales-de-referencia-de-andalucia-dera/descarga-de-informacion | Límites administrativos, relieve, hidrografía y usos del suelo de Andalucía | CC BY 4.0; capas WMS/WFS |
| es-atlas | https://github.com/martgnz/es-atlas | TopoJSON preconstruido de España: municipios, provincias y comunidades | Código MIT; datos IGN CC BY 4.0 |
| mapSpain (R) | https://github.com/ropenspain/mapSpain | Límites oficiales de España para prototipos en R | Útil si el equipo analiza en R |
| SIGPAC OGC API (FEGA) | https://sigpac-hubcloud.es/ogcapi | Recintos y cultivos declarados por bbox, municipio o provincia | CC BY 4.0; datos de alto valor |
| SIGPAC — descargas Andalucía | https://www.juntadeandalucia.es/organismos/agriculturapescaaguaydesarrollorural/servicios/sigpac/visor/paginas/sigpac-descarga-informacion-geografica-shapes-provincias.html | ZIP por provincia/municipio, campaña 2017-2026 | Atribución Junta de Andalucía |
| SIGPAC — servicios en la nube | https://www.fega.gob.es/es/pepac-2023-2027/sistemas-gestion-y-control/sigpac/nube-de-sigpac | WMS, MVT, consultas JSON/GeoJSON, OGC API y descargas | CC BY 4.0 |
| OpenFreeMap | https://openfreemap.org | Mapa base vectorial gratuito, sin API key | Datos OSM ODbL |
| Protomaps / PMTiles | https://docs.protomaps.com/pmtiles/maplibre | Mapa base en un solo archivo, ideal para offline | ODbL; revisar términos |
| Protomaps basemaps | https://docs.protomaps.com/basemaps/maplibre | Estilos y capas para MapLibre | ODbL |
| PMTiles | https://github.com/protomaps/PMTiles | Formato de teselas en un archivo | BSD-3-Clause |

### 1.2. Fincas, cultivos y geometrías

- **SIGPAC OGC API**: la vía más directa para fincas reales. Ejemplo de consulta por bbox:
  ~~~text
  https://sigpac-hubcloud.es/ogcapi/collections/recintos/items?bbox=-4.58,37.00,-4.54,37.04&limit=100&skipGeometry=true&f=json
  ~~~
- **Cultivo declarado**: colección cultivo_declarado; códigos de producto en la lista oficial de SIGPAC. El código 101 es olivar; 1 trigo blando; 3 trigo duro; 5 cebada; 8 avena; 33 girasol; 50 garbanzo; 60 alfalfa; 104 almendro.
- **Geometrías**: el CSV del repo tiene atributos y centroides, pero no polígonos. Para dibujar la finca seleccionada, pide los recintos a SIGPAC por provincia/municipio/polígono/parcela o exporta desde el GeoPackage con pipeline/sigpac.py.
- **Pipeline del repo**: pipeline/sigpac.py, pipeline/export_app_fincas.py, pipeline/export_app_indicators.py.

### 1.3. Datos agroclimáticos y de mercado

| Recurso | URL | Para qué | Nota |
|---|---|---|---|
| NASA POWER | https://power.larc.nasa.gov/ | Clima diario por punto: temperatura, lluvia, radiación, humedad, viento | Abierto; modelado; filtrar -999 |
| NASA GIBS | https://gibs.earthdata.nasa.gov/ | Teselas de visualización MODIS, IMERG, SMAP, GLDAS | PNG: visualización, no dato cuantitativo |
| NASA Earthdata | https://www.earthdata.nasa.gov/ | SMAP, IMERG, Landsat, GEDI y otros | Requiere Earthdata Login |
| MODIS MOD13Q1 | https://lpdaac.usgs.gov/products/mod13q1v061/ | NDVI/EVI cada 16 días a 250 m | Producto del pipeline |
| SoilGrids | https://soilgrids.org | Textura, carbono, pH, CEC y agua disponible a 250 m | CC BY 4.0; API REST |
| SoilGrids REST | https://rest.isric.org/soilgrids/v2.0/docs | Consulta por punto | CC BY 4.0 |
| LUCAS Soil (ESDAC) | https://esdac.jrc.ec.europa.eu/content/lucas-2018-topsoil-data | Muestras de suelo europeas | Registro; puntos dispersos |
| AEMET OpenData | https://www.aemet.es/es/datos_abiertos/AEMET_OpenData | Observación y clima de España | API key; atribución AEMET |
| ERA5 (Copernicus) | https://cds.climate.copernicus.eu/ | Reanálisis global horario | CDS API key |
| CHG — Confederación Hidrográfica del Guadalquivir | https://www.chguadalquivir.es/ | Cuenca, embalses y agua | Contexto de cuenca |
| Eurostat | https://ec.europa.eu/eurostat | Precios agrarios armonizados | Open data; atribución |
| MAPA — estadísticas agrarias | https://www.mapa.gob.es/es/estadistica/temas/ | Precios, superficies y producciones | Open data; atribución |

---

## 2. MapLibre: mapa 3D, hover y transiciones

| Recurso | URL | Para qué |
|---|---|---|
| MapLibre GL JS | https://maplibre.org/maplibre-gl-js/ | Motor de mapa base |
| 3D Terrain | https://maplibre.org/maplibre-gl-js/docs/examples/3d-terrain | Terreno 3D con raster-dem, sky y hillshade |
| Hover effect | https://maplibre.org/maplibre-gl-js/docs/examples/create-a-hover-effect | Resaltar una provincia/municipio con feature-state |
| Fill extrusion | https://maplibre.org/maplibre-gl-js/docs/examples/extrude-polygons-for-3d-indoor-mapping | Polígonos extruidos; útil para la portada estilizada |
| Three.js sobre terreno | https://maplibre.org/maplibre-gl-js/docs/examples/adding-3d-models-using-threejs-on-terrain | Modelos 3D anclados al terreno |
| Más ejemplos | https://maplibre.org/maplibre-gl-js/docs/examples/ | Sky/fog, flyTo, globo, capas personalizadas |
| Style spec | https://maplibre.org/maplibre-style-spec/layers | Referencia de capas y expresiones |
| MapTiler 3D | https://docs.maptiler.com/guides/maps-apis/maps-platform/how-to-build-a-3d-map-with-maplibre-v2-gl-js/ | Tutorial de terreno 3D con MapLibre |
| Mapterhorn | https://mapterhorn.com/ | Teselas de terreno globales para MapLibre |

### Patrón recomendado para el embudo

1. **Portada**: fitBounds de Andalucía, pitch 22, bearing 0, provincias con feature-state.
2. **Provincia**: fitBounds de Málaga, pitch 22, municipios con hover y heatmap de cultivo.
3. **Municipio**: fitBounds de Antequera, pitch 25, fincas candidatas.
4. **Finca**: fitBounds de la finca, pitch 38, y transición al diorama.

**No uses pitch 65 para el mapa macro**: produce una vista lateral. Reserva 45-65 para el diorama o para un plano cinematográfico muy concreto.

---

## 3. 3D, dioramas y animación

| Recurso | URL | Para qué |
|---|---|---|
| React Three Fiber | https://github.com/pmndrs/react-three-fiber | Diorama 3D declarativo en React |
| drei | https://github.com/pmndrs/drei | Cámara, controles, sombras, helpers |
| ADR de diorama isométrico | https://github.com/leonlarsson/isometrics/blob/main/docs/adr/0004-react-three-fiber-orthographic-diorama.md | Cámara ortográfica, orbit limitado, cards flotantes |
| Tiny Room | https://github.com/AndyLow14/tiny-room | Ejemplo de habitación isométrica con R3F y Theatre.js |
| r3f-terrain | https://github.com/Mozzius/r3f-terrain | Generador de terreno con R3F |
| geo-three | https://github.com/tentone/geo-three | Mapas de teselas en Three.js |
| three-geo | https://github.com/w3reality/three-geo | Terreno 3D a partir de datos geográficos |
| Qgis2threejs | https://github.com/minorua/Qgis2threejs | Exportar DEM + vectores a 3D/glTF desde QGIS |
| Theatre.js | https://github.com/theatre-js/theatre | Animaciones de cámara y objetos |
| Motion (Framer Motion) | https://www.framer.com/motion/ | Microanimaciones de UI |
| GSAP | https://gsap.com | Animaciones complejas y timelines |
| Lenis | https://github.com/darkroomengineering/lenis | Scroll suave (si hay scroll narrativo) |

### Patrón recomendado para el diorama

- Cámara ortográfica isométrica, no perspectiva.
- OrbitControls con límites de ángulo y zoom.
- Terreno low-poly a partir de DEM recortado (IGN MDT o Copernicus 30 m).
- Instanced meshes para olivos, cepas y espigas.
- Casa, canal y caminos con assets CC0.
- Etiqueta visible: "Representación esquemática; no es un gemelo digital".

---

## 4. Texturas y assets 3D

| Recurso | URL | Licencia | Para qué |
|---|---|---|---|
| Poly Haven | https://polyhaven.com | CC0 | Texturas PBR, HDRIs y modelos |
| AmbientCG | https://ambientcg.com | CC0 | Texturas PBR y materiales |
| Kenney | https://kenney.nl/assets | CC0 | Assets low-poly, UI y sonidos |
| Quaternius | https://quaternius.com | CC0/QAL | Personajes, granjas, animales y naturaleza |
| Quaternius Farm Buildings | https://quaternius.com/packs/farmbuildings.html | CC0 | Graneros, silos, vallas y casa |
| Poly Pizza | https://poly.pizza | CC-BY/CC0 | Modelos low-poly sueltos |
| Farm Buildings Bundle | https://poly.pizza/bundle/Farm-Buildings-Bundle-ppbnhEfNEt | CC0 | Pack de granja de Quaternius |
| three.js Assets — Countryside Farm | https://threejsassets.com/packs/farm | Comercial (29 USD) | Kit de granja listo para R3F/three.js |
| Sketchfab | https://sketchfab.com | Variable | Modelos concretos; revisar licencia |
| IGN PNOA | https://centrodedescargas.cnig.es/ | IGN | Ortofoto de España para contexto |
| Esri World Imagery | https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer | Esri | Satélite actual de la app |
| Copernicus Sentinel-2 | https://dataspace.copernicus.eu/ | Copernicus | Imágenes multiespectrales |
| Copernicus DEM | https://registry.opendata.aws/copernicus-dem | Copernicus | DEM global 30/90 m |
| Mapzen Terrain Tiles | https://registry.opendata.aws/terrain-tiles | Mixta; atribución | DEM global para MapLibre |

**Regla:** para texturas y assets, prioriza CC0. Si usas CC-BY, añade crédito visible. No uses modelos de Sketchfab sin comprobar la licencia.

---

## 5. UI, tipografía y glassmorphism

| Recurso | URL | Para qué |
|---|---|---|
| Tailwind CSS | https://tailwindcss.com | Utilidades CSS y design tokens |
| shadcn/ui | https://ui.shadcn.com | Componentes accesibles y personalizables |
| Radix UI | https://www.radix-ui.com | Primitivas accesibles para diálogos, tabs y sliders |
| Motion | https://www.framer.com/motion/ | Transiciones y microanimaciones |
| Fraunces | https://fonts.google.com/specimen/Fraunces | Titulares con serif editorial |
| Inter | https://fonts.google.com/specimen/Inter | Datos y UI |
| MDN backdrop-filter | https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter | Base del efecto glassmorphism |

**Consejo:** el glassmorphism funciona con **contraste**, no con transparencia extrema. Usa fondos crema/oliva, bordes finos y una sombra suave; evita el blanco translúcido sobre satélite claro.

---

## 6. Agentes, tickets y turno de noche

| Recurso | URL | Para qué |
|---|---|---|
| Magrathea — overnight agents | https://magratheasoftware.com/blog/overnight-autonomous-ai-dev-team.html | Logs reales de un turno nocturno; no push/merge/deploy |
| amux — guía de agentes overnight | https://amux.io/guides/ai-coding-agents-overnight/ | Task board, orquestador, worktrees y PRs |
| voundbrand/overnight | https://github.com/voundbrand/overnight | Workbench de PRs revisados sin merge |
| agent-queue | https://github.com/ElectricJack/agent-queue | Cola de tareas y orquestador de agentes |
| 35-agent swarm | https://dev.to/mdostal/i-built-a-35-agent-ai-coding-swarm-that-runs-overnight-440 | Lección: dedup guard y estado por ticket |
| Kult.io — AFK development | https://kult.io/success-stories/afk-development | El runner posee las gates; el agente no se autoaprueba |
| GitHub Copilot coding agent | https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-coding-agent | Issues asignadas a Copilot; ramas copilot/* |
| GitHub Actions — schedule | https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule | Cron con retrasos; no es un daemon |

**Regla de oro:** el turno de noche produce ramas y PRs; no hace push a main, no mergea y no despliega. El humano revisa por la mañana.

---

## 7. Skills del repo y skills recomendadas

### Skills que ya existen en el repo

- .agents/skills/python-testing-patterns/SKILL.md
- .agents/skills/vercel-react-best-practices/SKILL.md
- .agents/skills/verify-ciberpiso/SKILL.md
- .agents/skills/xlsx/SKILL.md

### Skills que conviene escribir

| Skill | Qué debería contener |
|---|---|
| maplibre-3d | Terrain, sky, hover, feature-state, flyTo, maxBounds |
| r3f-diorama | Cámara ortográfica, instancing, sombras, animaciones |
| sigpac | Endpoints, códigos de cultivo, licencias, consultas por bbox |
| agritech-ui | Paleta, glassmorphism, tarjetas, accesibilidad, motion tokens |
| overnight-swarm | Tickets, leases, worktrees, PR gates, presupuesto |

Formato sugerido: una carpeta por skill con SKILL.md, ejemplos y criterios de parada.

---

## 8. Prompts de imágenes y mockups

El generador de imágenes del host falló con "API key not valid". Estos prompts están pensados para Midjourney, DALL·E, Leonardo o Ideogram. El mockup HTML de la sesión está fuera del repo; si se quiere versionar, copiarlo a app/public/mockup/.

### 8.1. Portada de Andalucía

~~~text
Cinematic 3D aerial map of Andalusia, Spain, floating over a dark olive-green studio backdrop. The eight provinces are extruded low-poly terrain slabs in beige, terracotta, olive and cream, separated by thin glowing borders. Málaga is highlighted in warm gold with a soft hover glow. Minimal UI overlay top-left: "Ciberpiso" and breadcrumb "Andalucía". Volumetric light, depth of field, isometric perspective, premium agritech product design, physical diorama look, not a flat GIS map. Minimal legible text, no clutter.
~~~

### 8.2. Málaga y Antequera

~~~text
Close 3D aerial view of Málaga province, Andalusia, as a low-poly diorama. Municipalities separated by soft extruded borders; Antequera highlighted in warm cream and gold with the label "Antequera". Inside Antequera, small farm parcels as patchwork polygons in olive green, wheat, terracotta and dark green. UI breadcrumb "Andalucía > Málaga > Antequera" and a hover tooltip. Cinematic sunset light, dark UI background, sophisticated agritech interface, high detail, premium product design. Minimal legible text.
~~~

### 8.3. Diorama de finca

~~~text
Low-poly isometric farm diorama on a floating terrain tile: olive groves, cereal fields, a small white Andalusian farmhouse with a terracotta roof, an irrigation channel, cypress trees, soft hills in the background. A stylized low-poly farmer character stands at the edge of the field. Translucent glass flashcards float above the scene with sliders and abstract charts for water, soil, market and risk, warm amber accents. Soft shadows, golden-hour lighting, cute but premium, React Three Fiber style, 3D game art, dark olive and cream palette. Minimal legible text.
~~~

### 8.4. Pantalla completa

~~~text
Full-screen agritech app mockup, 16:9. Left 60%: 3D low-poly isometric farm diorama with olive groves, cereal fields, a white Andalusian farmhouse, an irrigation channel, and a small stylized farmer character. Right 40%: translucent glass flashcards with scenario sliders and data charts, suggesting "más agua" and "menos agua". Top breadcrumb "Andalucía > Málaga > Antequera > Finca". Dark olive and cream palette, warm amber accents, soft glassmorphism, premium Figma render, sophisticated product design, subtle depth of field. Minimal legible text.
~~~

---

## 9. Licencias y criterios de selección

| Tipo | Ejemplos | Qué hacer |
|---|---|---|
| CC0 | Kenney, Quaternius, Poly Haven, AmbientCG | Usar sin atribución; aun así, créditos en el README |
| CC BY 4.0 | SIGPAC, SoilGrids, IGN, es-atlas | Crédito visible y enlace a la fuente |
| ODbL | OpenStreetMap, OpenFreeMap, Protomaps | Atribución a OSM y a la fuente |
| NASA | POWER, GIBS, Earthdata | Atribución; NASA no respalda el proyecto |
| AEMET | OpenData | API key y atribución |
| Comercial | threejsassets, MapTiler, Mapbox | Revisar precio y términos; no meter keys en el cliente |
| Evitar | Google Photorealistic 3D Tiles, GIBS como dato, SSURGO/CDL/PRISM/NWIS para España | Coste, licencias o cobertura incorrecta |

**Checklist rápida:**

- [ ] ¿La fuente cubre Andalucía?
- [ ] ¿La licencia permite uso público y comercial?
- [ ] ¿La atribución está visible en la app?
- [ ] ¿El dato es observación, modelo o visualización?
- [ ] ¿La resolución permite la escala que prometemos?
- [ ] ¿La capa pesa lo suficiente como para romper la demo?

---

## 10. Referencias internas del repo

| Archivo | Para qué |
|---|---|
| app/src/components/MapView.tsx | Mapa, capas, satélite, GIBS, fincas |
| app/src/components/FincaPicker.tsx | Selección y hover de fincas; sustituir setFilter por feature-state |
| app/src/lib/terrain.ts | Terreno 3D y flyToField; cambiar pitch 65 |
| app/src/lib/fincas.ts | Carga del GeoJSON; separar candidatas/todas |
| app/src/lib/indicators.ts | Indicadores de las 26 candidatas |
| app/src/components/RealRotations.tsx | Tarjetas R0-R3 con evidencia, lagunas y riesgos |
| app/public/data/fincas_antequera.geojson | 14.529 fincas; 9,38 MB |
| app/public/data/indicators_antequera.json | 26 candidatas; 839 KB |
| pipeline/export_app_fincas.py | Exporta fincas para la app |
| pipeline/export_app_indicators.py | Exporta indicadores para la app |
| data/README.md | Modelo de datos, CSV y SQLite |
| docs/plan-de-accion.md | Caso de uso y rotaciones |
| .agents/skills/ | Skills de agentes del repo |

---

## 11. Enlaces de ejemplo y demos

- MapLibre examples: https://maplibre.org/maplibre-gl-js/docs/examples/
- MapLibre 3D terrain: https://maplibre.org/maplibre-gl-js/docs/examples/3d-terrain
- MapLibre hover: https://maplibre.org/maplibre-gl-js/docs/examples/create-a-hover-effect
- MapLibre three.js: https://maplibre.org/maplibre-gl-js/docs/examples/adding-3d-models-using-threejs-on-terrain
- Protomaps PMTiles: https://docs.protomaps.com/pmtiles/maplibre
- OpenFreeMap: https://openfreemap.org/quick_start/
- es-atlas: https://github.com/martgnz/es-atlas
- SIGPAC OGC API: https://sigpac-hubcloud.es/ogcapi
- IGN límites: https://centrodedescargas.cnig.es/CentroDescargas/limites-municipales-provinciales-autonomicos
- SoilGrids: https://soilgrids.org
- NASA POWER: https://power.larc.nasa.gov/
- NASA GIBS: https://gibs.earthdata.nasa.gov/
- R3F diorama ADR: https://github.com/leonlarsson/isometrics/blob/main/docs/adr/0004-react-three-fiber-orthographic-diorama.md
- Tiny Room: https://github.com/AndyLow14/tiny-room
- Quaternius Farm: https://quaternius.com/packs/farmbuildings.html
- Overnight agents: https://magratheasoftware.com/blog/overnight-autonomous-ai-dev-team.html

---

## 12. Mantenimiento

- Revisar esta nota cuando se añada una fuente nueva o cambie una licencia.
- No añadir enlaces sin comprobar que responden.
- Si una referencia se usa en la app, añadir la atribución en la UI y en el README.
- Si una referencia es solo inspiración, marcarla como tal.
