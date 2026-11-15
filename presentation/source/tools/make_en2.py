# Traduce build.js (v2, empieza por el problema) a build-en.js. Falla si falta algún texto.
import re
from pathlib import Path
s = Path("build.js").read_text()
R = [
 ('pres.author = "Equipo Ciberpiso"', 'pres.author = "Team Ciberpiso"'),
 ('"build/agrospace-static.pptx" : "build/agrospace-base.pptx"', '"build/agrospace-en-static.pptx" : "build/agrospace-en-base.pptx"'),
 # 1
 ('"LA ESPAÑA VACÍA"', '"EMPTY SPAIN"'),
 ('"3.834"', '"3,834"'),
 ('"municipios de España perdieron población\\nsolo en 2023: casi la mitad."', '"Spanish municipalities lost population\\nin 2023 alone: almost half."'),
 ('"Cuando vivir del campo deja de compensar, el pueblo se vacía."', '"When living off the land stops paying off, the village empties."'),
 ('"Fuente: INE, Censo Anual de Población a 1 de enero de 2024"', '"Source: INE (Spain\'s national statistics institute), Annual Population Census, 1 January 2024"'),
 # 2
 ('"EL PROBLEMA"', '"THE PROBLEM"'),
 ('"Sembrar a ciegas\\nen plena sequía"', '"Sowing blind\\nin a drought"'),
 ('"Cada otoño, el agricultor de secano decide qué sembrar. Se juega la campaña entre agua, suelo y mercado, y los datos de satélite que podrían ayudarle no le llegan."',
  '"Every autumn, the dryland farmer decides what to sow. The season is a gamble between water, soil and market, and the satellite data that could help never reaches them."'),
 ('[["453 mm", "lluvia media\\nal año"], ["302 mm", "en 2023: un tercio\\nmenos de lluvia"], ["792 mm", "de déficit hídrico\\nal año"]]',
  '[["453 mm", "mean rainfall\\nper year"], ["302 mm", "in 2023: a third\\nless rain"], ["792 mm", "water deficit\\nper year"]]'),
 ('"Finca de secano 29:15:2:18, Antequera (Málaga) · clima POWER"', '"Dryland farm 29:15:2:18, Antequera (Málaga) · POWER climate"'),
 # 3
 ('"Llevamos los datos de satélite a la decisión de cada finca"', '"We bring satellite data to every farm\'s decision"'),
 ('"Space Apps Challenge 2026  ·  Reto «Field Shift»  ·  Equipo Ciberpiso"', '"Space Apps Challenge 2026  ·  «Field Shift» challenge  ·  Team Ciberpiso"'),
 # 4
 ('"LA SOLUCIÓN", "Del territorio a tu finca, en cuatro pasos"', '"THE SOLUTION", "From territory to your farm, in four steps"'),
 ('"Andalucía → Málaga: la cámara atraviesa las nubes · demo real"', '"Andalucía → Málaga: the camera dives through the clouds · live demo"'),
 ('["Andalucía", "2.909.040 fincas SIGPAC en 8 provincias"]', '["Andalucía", "2,909,040 SIGPAC farms in 8 provinces"]'),
 ('["Málaga", "363.401 fincas en 103 municipios"]', '["Málaga", "363,401 farms in 103 municipalities"]'),
 ('["Antequera", "14.529 fincas, 26 candidatas"]', '["Antequera", "14,529 farms, 26 candidates"]'),
 ('["Tu finca", "Relieve, suelo, cultivos y 4 rotaciones"]', '["Your farm", "Relief, soil, crops and 4 rotations"]'),
 # 5
 ('"LA DEMO", "Aterriza en tu finca, en 3D"', '"THE DEMO", "Land on your farm, in 3D"'),
 ('["Relieve real", "Modelo digital del terreno, exagerado ×2"]', '["Real relief", "Digital elevation model, exaggerated ×2"]'),
 ('["Ortofoto real", "La finca tal y como se ve desde el aire"]', '["Real orthophoto", "The farm exactly as seen from the air"]'),
 ('["Perfil de suelo", "SoilGrids 2.0 en los laterales del bloque"]', '["Soil profile", "SoilGrids 2.0 on the sides of the block"]'),
 ('["Cultivo por campaña", "Visto por MODIS 2020–2025, y la rotación elegida hasta 2031"]', '["Crop by season", "Seen by MODIS 2020–2025, then the chosen rotation up to 2031"]'),
 # 6
 ('"LA DECISIÓN", "Cuatro rotaciones, una recomendación que se explica"', '"THE DECISION", "Four rotations, one recommendation that explains itself"'),
 ('name: "Actual · trigo–girasol"', 'name: "Current · wheat–sunflower"'),
 ('name: "+ garbanzo"', 'name: "+ chickpea"'), ('name: "+ veza"', 'name: "+ vetch"'), ('name: "+ barbecho"', 'name: "+ fallow"'),
 ('score: "67,3"', 'score: "67.3"'), ('score: "70,1"', 'score: "70.1"'), ('score: "69,6"', 'score: "69.6"'), ('score: "64,1"', 'score: "64.1"'),
 ('["Agua", "Suelo", "Mercado", "Riesgo"]', '["Water", "Soil", "Market", "Risk"]'),
 ('"★ Mejor para agua"', '"★ Best for water"'),
 ('v.toFixed(1).replace(".", ",")', 'v.toFixed(1)'),
 ('{ text: "Recomendación (prioridad agua): ", options: { bold: true, color: K.gold } },\n    { text: "R1 con garbanzo, 70,1 frente a 67,3 de hoy. Gana sobre todo en suelo (+7,5), aunque pierde en mercado (−4,8)." }',
  '{ text: "Recommendation (water first): ", options: { bold: true, color: K.gold } },\n    { text: "R1 with chickpea, 70.1 vs 67.3 today. It wins mainly on soil (+7.5), despite a weaker market (−4.8)." }'),
 ('[["Por qué", K.good], ["Evidencia", K.good], ["Lagunas de datos", K.warn], ["Riesgos a revisar en campo", K.warn]]',
  '[["Why", K.good], ["Evidence", K.good], ["Data gaps", K.warn], ["Risks to check in the field", K.warn]]'),
 ('"Datos abiertos reales: POWER · MODIS · SoilGrids · WorldCover · SIGPAC · SRTM"', '"Real open data: POWER · MODIS · SoilGrids · WorldCover · SIGPAC · SRTM"'),
 ('"NOTA DE AGUA VALIDADA"', '"VALIDATED WATER SCORE"'),
 ('"0,723"', '"0.723"'),
 ('"AUC frente a 0,627\\ncon solo lluvia"', '"AUC vs 0.627\\nwith rainfall only"'),
 ('"Detecta las campañas con estrés hídrico (360 temporadas-finca)"', '"Detects water-stressed seasons (360 farm-seasons)"'),
 # 7
 ('"Escanea y explora\\ntu propia finca"', '"Scan it and explore\\nyour own farm"'),
 ('"Demo en vivo en el navegador, sin instalar nada."', '"Live demo in the browser, nothing to install."'),
 ('"EQUIPO CIBERPISO"', '"TEAM CIBERPISO"'),
]
for a, b in R:
    if a not in s: raise SystemExit("NO ENCONTRADO: " + a[:90])
    s = s.replace(a, b)
NOTES = [
 "[≈20 s] We have all heard of Empty Spain: villages left without people. In 2023 alone, almost half of Spain's municipalities lost population. " +
 "And in the countryside it often starts the same way: a drought, a bad season, a wrong call on what to sow… and living off the land stops paying off.",
 "[≈25 s] Let's go down to a real dryland farm in Antequera, Málaga. It gets 453 litres of rain a year on average; in 2023, only 302, a third less. " +
 "And the crops would need almost 800 more than what falls. Every autumn the farmer decides what to sow: wheat and sunflower again, a legume, a fallow year? " +
 "The satellite data exists and is open, but it never reaches them.",
 "[≈10 s] That is why we built AgroSpace: from territory to farm. It brings satellite data to each farmer's decision, with no technical training needed.",
 "[≈20 s] It starts in Andalucía, with almost three million SIGPAC parcels, and drops like a funnel: Málaga, the municipality, and finally your farm. " +
 "Entering Málaga, the camera dives through the clouds.",
 "[≈20 s] And it lands on your farm in 3D: its real relief, its orthophoto, the soil profile and the crops the MODIS satellite saw every season since 2020. " +
 "Farmers recognise their land instantly.",
 "[≈30 s] For that farm we compare the current rotation with three alternatives, scored on water, soil, market and risk with explainable rules. " +
 "With water first, adding chickpea wins: 70.1 versus 67.3, and the tool explains why, with what evidence and what to check in the field. " +
 "Everything uses real open data, and the water score is validated: it detects water-stressed seasons better than rainfall alone.",
 "[≈15 s] Scan the QR code and try it live on any farm in Málaga. Let deciding what to sow stop being a gamble. " +
 "We are Team Ciberpiso: Gael, Nikhil, Jesús, Javier and Yeray. Thank you.",
]
blocks = list(re.finditer(r"s\.addNotes\(\n.*?\n  \);", s, re.S))
assert len(blocks) == 7, len(blocks)
for m, n in reversed(list(zip(blocks, NOTES))):
    js = "s.addNotes(\n    " + repr(n).replace("\\'", "'") .join(['', '']) + "\n  );"
    import json
    js = "s.addNotes(\n    " + json.dumps(n, ensure_ascii=False) + "\n  );"
    s = s[:m.start()] + js + s[m.end():]
Path("build-en.js").write_text(s)
print("ok", len(R), "reemplazos + 7 notas")
