# Crea build-en.js traduciendo los textos de build.js (falla si algún texto no aparece).
from pathlib import Path
src = Path("build.js").read_text()
R = [
 ('pres.author = "Equipo Ciberpiso"', 'pres.author = "Team Ciberpiso"'),
 ('"build/agrospace-static.pptx" : "build/agrospace-base.pptx"', '"build/agrospace-en-static.pptx" : "build/agrospace-en-base.pptx"'),
 # 1
 ('"Explorador de rotaciones de cultivo con datos de observación de la Tierra"', '"A crop rotation explorer built on Earth observation data"'),
 ('"Space Apps Challenge 2026  ·  Reto «Field Shift»  ·  Málaga"', '"Space Apps Challenge 2026  ·  «Field Shift» challenge  ·  Málaga"'),
 ('t(s, "Equipo Ciberpiso", {', 't(s, "Team Ciberpiso", {'),
 ('"Buenos días. Somos el equipo Ciberpiso y os presentamos AgroSpace: «from territory to farm», del territorio a la finca. " +\n    "Es una herramienta para que un agricultor de secano compare rotaciones de cultivo usando datos de observación de la Tierra, sin necesitar formación geoespacial."',
  '"Good morning. We are Team Ciberpiso, and this is AgroSpace: from territory to farm. " +\n    "It lets a dryland farmer compare crop rotations using Earth observation data, with no geospatial training needed."'),
 # 2
 ('"EL PROBLEMA"', '"THE PROBLEM"'),
 ('"¿Trigo y girasol\\notra vez?"', '"Wheat and sunflower\\nagain?"'),
 ('"En el secano de Antequera, el agricultor decide cada año qué sembrar. Cada rotación es un compromiso entre agua, suelo y mercado, y los datos de satélite que podrían ayudarle no están a su alcance."',
  '"In the drylands of Antequera, farmers decide every year what to sow. Each rotation is a trade-off between water, soil and market, and the satellite data that could help is out of their reach."'),
 ('[["453 mm", "lluvia media\\nal año"], ["792 mm", "de déficit hídrico\\nal año"], ["14.529", "fincas SIGPAC\\nsolo en Antequera"]]',
  '[["453 mm", "mean rainfall\\nper year"], ["792 mm", "water deficit\\nper year"], ["14,529", "SIGPAC farms\\nin Antequera alone"]]'),
 ('"Finca 29:15:2:18, Antequera · clima POWER 2002–2025"', '"Farm 29:15:2:18, Antequera · POWER climate 2002–2025"'),
 ('"Imaginad una finca de secano en Antequera. Llueven unos 453 milímetros al año, y el cultivo necesitaría 792 más. " +\n    "Cada otoño el agricultor elige: ¿repito trigo y girasol, meto una leguminosa, dejo barbecho? Cada opción gana en algo y pierde en otra cosa. " +\n    "Los datos de satélite existen y son abiertos, pero no están pensados para él."',
  '"Picture a dryland farm in Antequera. It gets about 453 millimetres of rain a year, and the crops would need 792 more. " +\n    "Every autumn the farmer chooses: wheat and sunflower again, a legume, or a fallow year? Each option wins on something and loses on something else. " +\n    "The satellite data exists and is open, but it was not built for them."'),
 # 3
 ('"LA SOLUCIÓN", "Del territorio a tu finca, en cuatro pasos"', '"THE SOLUTION", "From territory to your farm, in four steps"'),
 ('"Andalucía → Málaga: la cámara atraviesa las nubes · demo real"', '"Andalucía → Málaga: the camera dives through the clouds · live demo"'),
 ('["Andalucía", "2.909.040 fincas SIGPAC en 8 provincias"]', '["Andalucía", "2,909,040 SIGPAC farms in 8 provinces"]'),
 ('["Málaga", "363.401 fincas en 103 municipios"]', '["Málaga", "363,401 farms in 103 municipalities"]'),
 ('["Antequera", "14.529 fincas, 26 candidatas"]', '["Antequera", "14,529 farms, 26 candidates"]'),
 ('["Tu finca", "Relieve, suelo, cultivos y 4 rotaciones"]', '["Your farm", "Relief, soil, crops and 4 rotations"]'),
 ('"AgroSpace lleva al usuario como un embudo: empieza en Andalucía, con casi tres millones de fincas SIGPAC, baja a Málaga, luego al municipio, y aterriza en su finca. " +\n    "Cada transición está pensada para orientarse sin saber nada de mapas: al entrar en Málaga, la cámara atraviesa las nubes."',
  '"AgroSpace guides the user like a funnel: it starts in Andalucía, with almost three million SIGPAC farms, drops to Málaga, then to the municipality, and lands on their farm. " +\n    "Every transition is designed so you never get lost, even without any map skills: entering Málaga, the camera dives through the clouds."'),
 # 4
 ('"LA DEMO", "Aterriza en tu finca, en 3D"', '"THE DEMO", "Land on your farm, in 3D"'),
 ('["Relieve real", "Modelo digital del terreno, exagerado ×2"]', '["Real relief", "Digital elevation model, exaggerated ×2"]'),
 ('["Ortofoto real", "La finca tal y como se ve desde el aire"]', '["Real orthophoto", "The farm exactly as seen from the air"]'),
 ('["Perfil de suelo", "SoilGrids 2.0 en los laterales del bloque"]', '["Soil profile", "SoilGrids 2.0 on the sides of the block"]'),
 ('["Cultivo por campaña", "Visto por MODIS 2020–2025, y la rotación elegida hasta 2031"]', '["Crop by season", "Seen by MODIS 2020–2025, then the chosen rotation up to 2031"]'),
 ('"Al elegir una finca, el mapa vuela en cenital y se la entrega a una escena 3D que arranca idéntica píxel a píxel. " +\n    "Es su relieve real, su ortofoto real, el perfil de suelo de SoilGrids en los laterales, y los cultivos que el satélite MODIS vio cada campaña desde 2020. " +\n    "El agricultor reconoce su tierra al instante."',
  '"When you pick a farm, the map flies overhead and hands it to a 3D scene that starts pixel-identical. " +\n    "It is the real relief, the real orthophoto, the SoilGrids soil profile on the sides, and the crops the MODIS satellite saw every season since 2020. " +\n    "The farmer recognises their land instantly."'),
 # 5
 ('"LA DECISIÓN", "Cuatro rotaciones, una recomendación que se explica"', '"THE DECISION", "Four rotations, one recommendation that explains itself"'),
 ('name: "Actual · trigo–girasol"', 'name: "Current · wheat–sunflower"'),
 ('name: "+ garbanzo"', 'name: "+ chickpea"'),
 ('name: "+ veza"', 'name: "+ vetch"'),
 ('name: "+ barbecho"', 'name: "+ fallow"'),
 ('score: "67,3"', 'score: "67.3"'), ('score: "70,1"', 'score: "70.1"'), ('score: "69,6"', 'score: "69.6"'), ('score: "64,1"', 'score: "64.1"'),
 ('["Agua", "Suelo", "Mercado", "Riesgo"]', '["Water", "Soil", "Market", "Risk"]'),
 ('"★ Mejor para agua"', '"★ Best for water"'),
 ('v.toFixed(1).replace(".", ",")', 'v.toFixed(1)'),
 ('{ text: "Recomendación (prioridad agua): ", options: { bold: true, color: K.gold } },\n    { text: "R1 con garbanzo, 70,1 frente a 67,3 de hoy. Gana sobre todo en suelo (+7,5), aunque pierde en mercado (−4,8)." }',
  '{ text: "Recommendation (water first): ", options: { bold: true, color: K.gold } },\n    { text: "R1 with chickpea, 70.1 vs 67.3 today. It wins mainly on soil (+7.5), despite a weaker market (−4.8)." }'),
 ('[["Por qué", K.good], ["Evidencia", K.good], ["Lagunas de datos", K.warn], ["Riesgos a revisar en campo", K.warn]]',
  '[["Why", K.good], ["Evidence", K.good], ["Data gaps", K.warn], ["Risks to check in the field", K.warn]]'),
 ('"Cada rotación lo muestra. El agricultor elige la prioridad: agua, suelo o mercado."', '"Every rotation shows them. The farmer picks the priority: water, soil or market."'),
 ('"Para esa finca comparamos la rotación actual, trigo y girasol, con tres alternativas: meter garbanzo, veza o barbecho. " +\n    "Cada una se puntúa en agua, suelo, mercado y riesgo climático, con reglas explicables, no con una caja negra. " +\n    "Con prioridad agua gana R1, con garbanzo: 70,1 frente a 67,3. Y la herramienta dice por qué, con qué evidencia, qué datos faltan y qué hay que revisar en campo."',
  '"For that farm we compare the current rotation, wheat and sunflower, with three alternatives: adding chickpea, vetch or a fallow year. " +\n    "Each one is scored on water, soil, market and climate risk, with explainable rules, not a black box. " +\n    "With water first, R1 with chickpea wins: 70.1 versus 67.3. And the tool says why, with what evidence, which data is missing and what to check in the field."'),
 # 6
 ('"EL RIGOR", "Datos abiertos reales, y la incertidumbre a la vista"', '"THE RIGOUR", "Real open data, with the uncertainty in plain sight"'),
 ('["POWER", "clima 2002–2025"], ["MODIS", "NDVI y fenología 2020–2025"]', '["POWER", "climate 2002–2025"], ["MODIS", "NDVI and phenology 2020–2025"]'),
 ('["SoilGrids 2.0", "textura, pH, agua del suelo"], ["ESA WorldCover", "usos del suelo"]', '["SoilGrids 2.0", "texture, pH, soil water"], ["ESA WorldCover", "land cover"]'),
 ('["SIGPAC", "2,9 millones de parcelas"], ["Eurostat · MAPA", "precios de referencia"]', '["SIGPAC", "2.9 million parcels"], ["Eurostat · MAPA", "reference prices"]'),
 ('t(s, "FUENTES", {', 't(s, "SOURCES", {'),
 ('"¿Detecta las campañas con estrés hídrico? (AUC, 360 temporadas-finca)"', '"Does it detect water-stressed seasons? (AUC, 360 farm-seasons)"'),
 ('labels: ["Solo lluvia", "Nota de agua AgroSpace"]', 'labels: ["Rainfall only", "AgroSpace water score"]'),
 ('[["1.144 · 0", "valores comparados entre la app y el\\npipeline Python, sin ninguna diferencia"], ["960 · 0", "indicadores auditados, sin ningún fallo"]]',
  '[["1,144 · 0", "values compared between the app and\\nthe Python pipeline, zero differences"], ["960 · 0", "indicators audited, zero failures"]]'),
 ('{ text: "Lo que aún no sabemos, lo decimos. ", options: { bold: true, color: K.text } },\n    { text: "El mercado es un proxy de precio (sin rendimientos ni costes) y las notas de suelo y riesgo aún no están validadas: la app baja la confianza cuando faltan datos y lo enseña.", options: { color: K.muted } }',
  '{ text: "What we don\'t know yet, we say. ", options: { bold: true, color: K.text } },\n    { text: "Market is a price proxy (no yields or costs) and the soil and risk scores are not validated yet: the app lowers its confidence when data is missing, and shows it.", options: { color: K.muted } }'),
 ('"Todo sale de datos abiertos reales: clima POWER, NDVI de MODIS, suelo de SoilGrids, WorldCover, parcelas SIGPAC y precios de Eurostat. " +\n    "Validamos la nota de agua con 360 temporadas-finca: detecta mejor el estrés hídrico que la lluvia sola, AUC 0,723 frente a 0,627. " +\n    "El cálculo de la web coincide al cien por cien con el pipeline en Python. Y somos honestos: lo que no está validado, la herramienta lo dice."',
  '"Everything comes from real open data: POWER climate, MODIS NDVI, SoilGrids soil, WorldCover, SIGPAC parcels and Eurostat prices. " +\n    "We validated the water score on 360 farm-seasons: it detects water stress better than rainfall alone, AUC 0.723 versus 0.627. " +\n    "The web calculation matches the Python pipeline one hundred percent. And we are honest: whatever is not validated, the tool says so."'),
 ('dataLabelFormatCode: \'"0,"000\'', 'dataLabelFormatCode: \'"0."000\''),
 # 7
 ('"Escanea y explora\\ntu propia finca"', '"Scan it and explore\\nyour own farm"'),
 ('"Demo en vivo en el navegador, sin instalar nada."', '"Live demo in the browser, nothing to install."'),
 ('"EQUIPO CIBERPISO"', '"TEAM CIBERPISO"'),
 ('"Os dejamos el QR: abre la demo en vivo, sin instalar nada. Podéis buscar cualquier finca de Málaga por su referencia SIGPAC. " +\n    "Somos Gael, Nikhil, Jesús, Javier y Yeray, el equipo Ciberpiso. Muchas gracias."',
  '"Here is the QR code: it opens the live demo, nothing to install. You can search any farm in Málaga by its SIGPAC reference. " +\n    "We are Gael, Nikhil, Jesús, Javier and Yeray, Team Ciberpiso. Thank you."'),
]
out = src
for a, b in R:
    n = out.count(a)
    if n == 0:
        raise SystemExit("NO ENCONTRADO: " + a[:90])
    out = out.replace(a, b)
Path("build-en.js").write_text(out)
print("ok", len(R), "reemplazos")
