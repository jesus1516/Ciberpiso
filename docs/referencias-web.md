# References for the AgroSpace website

> Inspiration and technical support note for the AgroSpace app. They are not mandatory dependencies: it is a curated list of maps, data, textures, repositories and patterns that can improve the website. Last review: **2026-11-14**.

> **Note:** the current app **does not use Google Maps**. It uses **Esri World Imagery** for the satellite view, **Mapzen Terrarium** for the terrain and **GIBS** for the optional layers. These references are for improving or replacing parts with judgement, not for adding them all.

## How to use this note

| If you want... | Look at... |
|---|---|
| A 3D map from above with relief | MapLibre 3D Terrain + Mapzen/Copernicus DEM |
| Highlight provinces or municipalities on mouse hover | MapLibre hover + feature-state (section 2) |
| Enter Málaga/Antequera with an animation | MapLibre flyTo + overlay (section 2) |
| A low-poly diorama of the farm | React Three Fiber + drei (section 3) |
| Free 3D textures and assets | Poly Haven, AmbientCG, Kenney, Quaternius (section 4) |
| Boundaries of Andalucía, provinces and municipalities | IGN CNIG, IECA DERA, es-atlas (section 1) |
| Real farms and crops | SIGPAC OGC API (section 1) |
| Climate, soil and prices | POWER, SoilGrids, AEMET, Eurostat/MAPA (section 1) |
| Glassmorphism-style UI | Tailwind + Radix/shadcn + Motion (section 5) |
| Agents that work at night | Magrathea, amux, voundbrand/overnight (section 6) |

---

## 1. Maps, boundaries and geodata

### 1.1. Andalucía, provinces and municipalities

| Resource | URL | What for | Note |
|---|---|---|---|
| IGN CNIG — Municipal, provincial and regional boundaries | https://centrodedescargas.cnig.es/CentroDescargas/limites-municipales-provinciales-autonomicos | Official boundaries of Spain in SHP/GPKG/GML and WFS | IGN attribution; accuracy ~40 m |
| IECA DERA — Reference Spatial Data of Andalucía | https://www.juntadeandalucia.es/institutodeestadisticaycartografia/dega/datos-espaciales-de-referencia-de-andalucia-dera/descarga-de-informacion | Administrative boundaries, relief, hydrography and land uses of Andalucía | CC BY 4.0; WMS/WFS layers |
| es-atlas | https://github.com/martgnz/es-atlas | Prebuilt TopoJSON of Spain: municipalities, provinces and autonomous communities | MIT code; IGN data CC BY 4.0 |
| mapSpain (R) | https://github.com/ropenspain/mapSpain | Official boundaries of Spain for R prototypes | Useful if the team analyses in R |
| SIGPAC OGC API (FEGA) | https://sigpac-hubcloud.es/ogcapi | Enclosures and declared crops by bbox, municipality or province | CC BY 4.0; high-value data |
| SIGPAC — Andalucía downloads | https://www.juntadeandalucia.es/organismos/agriculturapescaaguaydesarrollorural/servicios/sigpac/visor/paginas/sigpac-descarga-informacion-geografica-shapes-provincias.html | ZIP per province/municipality, seasons 2017-2026 | Junta de Andalucía attribution |
| SIGPAC — cloud services | https://www.fega.gob.es/es/pepac-2023-2027/sistemas-gestion-y-control/sigpac/nube-de-sigpac | WMS, MVT, JSON/GeoJSON queries, OGC API and downloads | CC BY 4.0 |
| OpenFreeMap | https://openfreemap.org | Free vector basemap, no API key | OSM data, ODbL |
| Protomaps / PMTiles | https://docs.protomaps.com/pmtiles/maplibre | Basemap in a single file, ideal for offline | ODbL; check terms |
| Protomaps basemaps | https://docs.protomaps.com/basemaps/maplibre | Styles and layers for MapLibre | ODbL |
| PMTiles | https://github.com/protomaps/PMTiles | Single-file tile format | BSD-3-Clause |

### 1.2. Farms, crops and geometries

- **SIGPAC OGC API**: the most direct route to real farms. Example query by bbox:
  ~~~text
  https://sigpac-hubcloud.es/ogcapi/collections/recintos/items?bbox=-4.58,37.00,-4.54,37.04&limit=100&skipGeometry=true&f=json
  ~~~
- **Declared crop**: collection cultivo_declarado; product codes in the official SIGPAC list. Code 101 is olive grove; 1 soft wheat; 3 durum wheat; 5 barley; 8 oat; 33 sunflower; 50 chickpea; 60 alfalfa; 104 almond.
- **Geometries**: the repo's CSV has attributes and centroids, but no polygons. To draw the selected farm, request the enclosures from SIGPAC by province/municipality/polygon/plot or export from the GeoPackage with pipeline/sigpac.py.
- **Repo pipeline**: pipeline/sigpac.py, pipeline/export_app_fincas.py, pipeline/export_app_indicators.py.

### 1.3. Agroclimatic and market data

| Resource | URL | What for | Note |
|---|---|---|---|
| POWER | https://power.larc.nasa.gov/ | Daily climate per point: temperature, rain, radiation, humidity, wind | Open; modelled; filter -999 |
| GIBS | https://gibs.earthdata.nasa.gov/ | MODIS, IMERG, SMAP, GLDAS visualisation tiles | PNG: visualisation, not quantitative data |
| Earthdata | https://www.earthdata.nasa.gov/ | SMAP, IMERG, Landsat, GEDI and others | Requires Earthdata Login |
| MODIS MOD13Q1 | https://lpdaac.usgs.gov/products/mod13q1v061/ | NDVI/EVI every 16 days at 250 m | Pipeline product |
| SoilGrids | https://soilgrids.org | Texture, carbon, pH, CEC and available water at 250 m | CC BY 4.0; REST API |
| SoilGrids REST | https://rest.isric.org/soilgrids/v2.0/docs | Query by point | CC BY 4.0 |
| LUCAS Soil (ESDAC) | https://esdac.jrc.ec.europa.eu/content/lucas-2018-topsoil-data | European soil samples | Registration; scattered points |
| AEMET OpenData | https://www.aemet.es/es/datos_abiertos/AEMET_OpenData | Observation and climate of Spain | API key; AEMET attribution |
| ERA5 (Copernicus) | https://cds.climate.copernicus.eu/ | Global hourly reanalysis | CDS API key |
| CHG — Confederación Hidrográfica del Guadalquivir | https://www.chguadalquivir.es/ | Basin, reservoirs and water | Basin context |
| Eurostat | https://ec.europa.eu/eurostat | Harmonised agricultural prices | Open data; attribution |
| MAPA — agricultural statistics | https://www.mapa.gob.es/es/estadistica/temas/ | Prices, areas and production | Open data; attribution |

---

## 2. MapLibre: 3D map, hover and transitions

| Resource | URL | What for |
|---|---|---|
| MapLibre GL JS | https://maplibre.org/maplibre-gl-js/ | Base map engine |
| 3D Terrain | https://maplibre.org/maplibre-gl-js/docs/examples/3d-terrain | 3D terrain with raster-dem, sky and hillshade |
| Hover effect | https://maplibre.org/maplibre-gl-js/docs/examples/create-a-hover-effect | Highlight a province/municipality with feature-state |
| Fill extrusion | https://maplibre.org/maplibre-gl-js/docs/examples/extrude-polygons-for-3d-indoor-mapping | Extruded polygons; useful for the stylised landing page |
| Three.js on terrain | https://maplibre.org/maplibre-gl-js/docs/examples/adding-3d-models-using-threejs-on-terrain | 3D models anchored to the terrain |
| More examples | https://maplibre.org/maplibre-gl-js/docs/examples/ | Sky/fog, flyTo, globe, custom layers |
| Style spec | https://maplibre.org/maplibre-style-spec/layers | Reference for layers and expressions |
| MapTiler 3D | https://docs.maptiler.com/guides/maps-apis/maps-platform/how-to-build-a-3d-map-with-maplibre-v2-gl-js/ | 3D terrain tutorial with MapLibre |
| Mapterhorn | https://mapterhorn.com/ | Global terrain tiles for MapLibre |

### Recommended pattern for the funnel

1. **Landing page**: fitBounds of Andalucía, pitch 22, bearing 0, provinces with feature-state.
2. **Province**: fitBounds of Málaga, pitch 22, municipalities with hover and a crop heatmap.
3. **Municipality**: fitBounds of Antequera, pitch 25, candidate farms.
4. **Farm**: fitBounds of the farm, pitch 38, and transition to the diorama.

**Do not use pitch 65 for the macro map**: it produces a side view. Reserve 45-65 for the diorama or for a very specific cinematic shot.

---

## 3. 3D, dioramas and animation

| Resource | URL | What for |
|---|---|---|
| React Three Fiber | https://github.com/pmndrs/react-three-fiber | Declarative 3D diorama in React |
| drei | https://github.com/pmndrs/drei | Camera, controls, shadows, helpers |
| Isometric diorama ADR | https://github.com/leonlarsson/isometrics/blob/main/docs/adr/0004-react-three-fiber-orthographic-diorama.md | Orthographic camera, limited orbit, floating cards |
| Tiny Room | https://github.com/AndyLow14/tiny-room | Isometric room example with R3F and Theatre.js |
| r3f-terrain | https://github.com/Mozzius/r3f-terrain | Terrain generator with R3F |
| geo-three | https://github.com/tentone/geo-three | Tile maps in Three.js |
| three-geo | https://github.com/w3reality/three-geo | 3D terrain from geographic data |
| Qgis2threejs | https://github.com/minorua/Qgis2threejs | Export DEM + vectors to 3D/glTF from QGIS |
| Theatre.js | https://github.com/theatre-js/theatre | Camera and object animations |
| Motion (Framer Motion) | https://www.framer.com/motion/ | UI micro-animations |
| GSAP | https://gsap.com | Complex animations and timelines |
| Lenis | https://github.com/darkroomengineering/lenis | Smooth scrolling (if there is narrative scrolling) |

### Recommended pattern for the diorama

- Isometric orthographic camera, not perspective.
- OrbitControls with angle and zoom limits.
- Low-poly terrain from a clipped DEM (IGN MDT or Copernicus 30 m).
- Instanced meshes for olive trees, vines and wheat ears.
- House, channel and paths with CC0 assets.
- Visible label: "Schematic representation; not a digital twin".

---

## 4. Textures and 3D assets

| Resource | URL | Licence | What for |
|---|---|---|---|
| Poly Haven | https://polyhaven.com | CC0 | PBR textures, HDRIs and models |
| AmbientCG | https://ambientcg.com | CC0 | PBR textures and materials |
| Kenney | https://kenney.nl/assets | CC0 | Low-poly assets, UI and sounds |
| Quaternius | https://quaternius.com | CC0/QAL | Characters, farms, animals and nature |
| Quaternius Farm Buildings | https://quaternius.com/packs/farmbuildings.html | CC0 | Barns, silos, fences and house |
| Poly Pizza | https://poly.pizza | CC-BY/CC0 | Individual low-poly models |
| Farm Buildings Bundle | https://poly.pizza/bundle/Farm-Buildings-Bundle-ppbnhEfNEt | CC0 | Quaternius farm pack |
| three.js Assets — Countryside Farm | https://threejsassets.com/packs/farm | Commercial (29 USD) | Farm kit ready for R3F/three.js |
| Sketchfab | https://sketchfab.com | Variable | Specific models; check the licence |
| IGN PNOA | https://centrodedescargas.cnig.es/ | IGN | Orthophoto of Spain for context |
| Esri World Imagery | https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer | Esri | Current satellite of the app |
| Copernicus Sentinel-2 | https://dataspace.copernicus.eu/ | Copernicus | Multispectral imagery |
| Copernicus DEM | https://registry.opendata.aws/copernicus-dem | Copernicus | Global DEM 30/90 m |
| Mapzen Terrain Tiles | https://registry.opendata.aws/terrain-tiles | Mixed; attribution | Global DEM for MapLibre |

**Rule:** for textures and assets, prioritise CC0. If you use CC-BY, add visible credit. Do not use Sketchfab models without checking the licence.

---

## 5. UI, typography and glassmorphism

| Resource | URL | What for |
|---|---|---|
| Tailwind CSS | https://tailwindcss.com | CSS utilities and design tokens |
| shadcn/ui | https://ui.shadcn.com | Accessible, customisable components |
| Radix UI | https://www.radix-ui.com | Accessible primitives for dialogs, tabs and sliders |
| Motion | https://www.framer.com/motion/ | Transitions and micro-animations |
| Fraunces | https://fonts.google.com/specimen/Fraunces | Headlines with an editorial serif |
| Inter | https://fonts.google.com/specimen/Inter | Data and UI |
| MDN backdrop-filter | https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter | Basis of the glassmorphism effect |

**Tip:** glassmorphism works with **contrast**, not with extreme transparency. Use cream/olive backgrounds, thin borders and a soft shadow; avoid translucent white over bright satellite imagery.

---

## 6. Agents, tickets and night shift

| Resource | URL | What for |
|---|---|---|
| Magrathea — overnight agents | https://magratheasoftware.com/blog/overnight-autonomous-ai-dev-team.html | Real logs of a night shift; no push/merge/deploy |
| amux — overnight agents guide | https://amux.io/guides/ai-coding-agents-overnight/ | Task board, orchestrator, worktrees and PRs |
| voundbrand/overnight | https://github.com/voundbrand/overnight | Workbench of reviewed PRs without merge |
| agent-queue | https://github.com/ElectricJack/agent-queue | Task queue and agent orchestrator |
| 35-agent swarm | https://dev.to/mdostal/i-built-a-35-agent-ai-coding-swarm-that-runs-overnight-440 | Lesson: dedup guard and per-ticket state |
| Kult.io — AFK development | https://kult.io/success-stories/afk-development | The runner owns the gates; the agent does not approve itself |
| GitHub Copilot coding agent | https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-coding-agent | Issues assigned to Copilot; copilot/* branches |
| GitHub Actions — schedule | https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule | Cron with delays; not a daemon |

**Golden rule:** the night shift produces branches and PRs; it does not push to main, does not merge and does not deploy. The human reviews in the morning.

---

## 7. Repo skills and recommended skills

### Skills that already exist in the repo

- .agents/skills/python-testing-patterns/SKILL.md
- .agents/skills/vercel-react-best-practices/SKILL.md
- .agents/skills/verify-agrospace/SKILL.md
- .agents/skills/xlsx/SKILL.md

### Skills worth writing

| Skill | What it should contain |
|---|---|
| maplibre-3d | Terrain, sky, hover, feature-state, flyTo, maxBounds |
| r3f-diorama | Orthographic camera, instancing, shadows, animations |
| sigpac | Endpoints, crop codes, licences, queries by bbox |
| agritech-ui | Palette, glassmorphism, cards, accessibility, motion tokens |
| overnight-swarm | Tickets, leases, worktrees, PR gates, budget |

Suggested format: one folder per skill with SKILL.md, examples and stopping criteria.

---

## 8. Image prompts and mockups

The host's image generator failed with "API key not valid". These prompts are meant for Midjourney, DALL·E, Leonardo or Ideogram. The session's HTML mockup is outside the repo; if you want to version it, copy it to app/public/mockup/.

### 8.1. Andalucía landing page

~~~text
Cinematic 3D aerial map of Andalusia, Spain, floating over a dark olive-green studio backdrop. The eight provinces are extruded low-poly terrain slabs in beige, terracotta, olive and cream, separated by thin glowing borders. Málaga is highlighted in warm gold with a soft hover glow. Minimal UI overlay top-left: "AgroSpace" and breadcrumb "Andalucía". Volumetric light, depth of field, isometric perspective, premium agritech product design, physical diorama look, not a flat GIS map. Minimal legible text, no clutter.
~~~

### 8.2. Málaga and Antequera

~~~text
Close 3D aerial view of Málaga province, Andalusia, as a low-poly diorama. Municipalities separated by soft extruded borders; Antequera highlighted in warm cream and gold with the label "Antequera". Inside Antequera, small farm parcels as patchwork polygons in olive green, wheat, terracotta and dark green. UI breadcrumb "Andalucía > Málaga > Antequera" and a hover tooltip. Cinematic sunset light, dark UI background, sophisticated agritech interface, high detail, premium product design. Minimal legible text.
~~~

### 8.3. Farm diorama

~~~text
Low-poly isometric farm diorama on a floating terrain tile: olive groves, cereal fields, a small white Andalusian farmhouse with a terracotta roof, an irrigation channel, cypress trees, soft hills in the background. A stylized low-poly farmer character stands at the edge of the field. Translucent glass flashcards float above the scene with sliders and abstract charts for water, soil, market and risk, warm amber accents. Soft shadows, golden-hour lighting, cute but premium, React Three Fiber style, 3D game art, dark olive and cream palette. Minimal legible text.
~~~

### 8.4. Full screen

~~~text
Full-screen agritech app mockup, 16:9. Left 60%: 3D low-poly isometric farm diorama with olive groves, cereal fields, a white Andalusian farmhouse, an irrigation channel, and a small stylized farmer character. Right 40%: translucent glass flashcards with scenario sliders and data charts, suggesting "more water" and "less water". Top breadcrumb "Andalucía > Málaga > Antequera > Farm". Dark olive and cream palette, warm amber accents, soft glassmorphism, premium Figma render, sophisticated product design, subtle depth of field. Minimal legible text.
~~~

---

## 9. Licences and selection criteria

| Type | Examples | What to do |
|---|---|---|
| CC0 | Kenney, Quaternius, Poly Haven, AmbientCG | Use without attribution; still, credits in the README |
| CC BY 4.0 | SIGPAC, SoilGrids, IGN, es-atlas | Visible credit and link to the source |
| ODbL | OpenStreetMap, OpenFreeMap, Protomaps | Attribution to OSM and to the source |
| Space agency | POWER, GIBS, Earthdata | Attribution; the agency does not endorse the project |
| AEMET | OpenData | API key and attribution |
| Commercial | threejsassets, MapTiler, Mapbox | Check price and terms; do not put keys in the client |
| Avoid | Google Photorealistic 3D Tiles, GIBS as data, SSURGO/CDL/PRISM/NWIS for Spain | Cost, licences or wrong coverage |

**Quick checklist:**

- [ ] Does the source cover Andalucía?
- [ ] Does the licence allow public and commercial use?
- [ ] Is the attribution visible in the app?
- [ ] Is the data an observation, a model or a visualisation?
- [ ] Does the resolution allow the scale we promise?
- [ ] Is the layer heavy enough to break the demo?

---

## 10. Internal references in the repo

| File | What for |
|---|---|
| app/src/explorer/controller.ts | Map, the four levels and their transitions (MapLibre) |
| app/src/explorer/diorama.ts | The farm in 3D (three.js): terrain, trees, markers |
| app/src/explorer/FarmView.tsx | Farm column: insights, cards, timeline, rotations |
| app/src/explorer/FullDataPanel.tsx | "Full data" drawer: farm, soil, vegetation, climate |
| app/src/lib/farms.ts | Municipality farms, parsed in a Web Worker |
| app/src/lib/calculator.ts | Rotation engine (port of pipeline/calculator.py) |
| app/src/lib/indicators.ts | Precomputed results of the 26 Antequera candidates |
| app/public/data/fincas/ | Farms per municipality (GeoJSON, gzip) |
| app/public/data/detalle/ | Farm detail per municipality (JSON, gzip) |
| app/public/data/indicators_antequera.json | 26 candidates; 839 KB |
| pipeline/export_app_fincas.py | Exports farms for the app |
| pipeline/export_app_indicators.py | Exports indicators for the app |
| data/README.md | Data model, CSV and SQLite |
| docs/rotaciones.md | Use case and rotations |

---

## 11. Example links and demos

- MapLibre examples: https://maplibre.org/maplibre-gl-js/docs/examples/
- MapLibre 3D terrain: https://maplibre.org/maplibre-gl-js/docs/examples/3d-terrain
- MapLibre hover: https://maplibre.org/maplibre-gl-js/docs/examples/create-a-hover-effect
- MapLibre three.js: https://maplibre.org/maplibre-gl-js/docs/examples/adding-3d-models-using-threejs-on-terrain
- Protomaps PMTiles: https://docs.protomaps.com/pmtiles/maplibre
- OpenFreeMap: https://openfreemap.org/quick_start/
- es-atlas: https://github.com/martgnz/es-atlas
- SIGPAC OGC API: https://sigpac-hubcloud.es/ogcapi
- IGN boundaries: https://centrodedescargas.cnig.es/CentroDescargas/limites-municipales-provinciales-autonomicos
- SoilGrids: https://soilgrids.org
- POWER: https://power.larc.nasa.gov/
- GIBS: https://gibs.earthdata.nasa.gov/
- R3F diorama ADR: https://github.com/leonlarsson/isometrics/blob/main/docs/adr/0004-react-three-fiber-orthographic-diorama.md
- Tiny Room: https://github.com/AndyLow14/tiny-room
- Quaternius Farm: https://quaternius.com/packs/farmbuildings.html
- Overnight agents: https://magratheasoftware.com/blog/overnight-autonomous-ai-dev-team.html

---

## 12. Maintenance

- Review this note when a new source is added or a licence changes.
- Do not add links without checking that they respond.
- If a reference is used in the app, add the attribution in the UI and in the README.
- If a reference is only inspiration, mark it as such.
