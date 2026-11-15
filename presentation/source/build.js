// Genera la maqueta del deck (sin transiciones ni animaciones). Versión v2: arranca por el problema.
// Después: python3 tools/animate.py build/agrospace-base.pptx anim.json AgroSpace.pptx
// Guion de 2–3 minutos en las notas del orador.
const pptxgen = require("pptxgenjs");
const fs = require("fs");

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 in
pres.title = "AgroSpace · From territory to farm";
pres.author = "Equipo Ciberpiso";
pres.theme = { headFontFace: "Georgia", bodyFontFace: "Calibri" };

// Paleta de la app (app/src/explorer/tokens.ts) y de marca (verde, paja, marfil)
const K = {
  bg: "141C11", card: "1E2A1A", line: "3A4A34", text: "F4E9D8", muted: "B9BEA9",
  dim: "7C8872", gold: "E9D58B", straw: "F4BA38", green: "103B2D", ivory: "FFF3DA",
  good: "6DB6FF", warn: "F0983A", cereal: "E3C25F", legume: "6FB7A0", fallow: "AD8B65",
};
const HEAD = "Georgia", BODY = "Calibri";
const W = 13.333;
const IMG = "img/", GIF = "gifs/";
// STATIC=1: misma maqueta con fotogramas fijos en lugar de GIFs (para el PDF de respaldo)
const STATIC = process.env.STATIC === "1";
const media = (gif, still) => (STATIC ? IMG + still : GIF + gif);
const OUT = STATIC ? "build/agrospace-static.pptx" : "build/agrospace-base.pptx";

pres.defineSlideMaster({ title: "OSCURO", background: { color: K.bg } });
pres.defineSlideMaster({ title: "MARFIL", background: { color: K.ivory } });

const t = (s, text, o) => s.addText(text, { isTextBox: true, margin: 0, fontFace: BODY, color: K.text, valign: "top", ...o });
const pg = (s, n) => t(s, `0${n} / 07`, { x: 11.3, y: 0.48, w: 1.5, h: 0.3, fontSize: 11, color: K.dim, align: "right", charSpacing: 2, objectName: "!!pg" });

// Elementos fijos de las diapositivas oscuras con marca (mismo nombre: Morph los deja quietos)
function chrome(s, n, eyebrow, title) {
  s.addImage({ path: IMG + "agrospace-mark.png", x: 0.55, y: 0.38, w: 0.6, h: 0.6 * 251 / 292, objectName: "!!logo" });
  t(s, "AgroSpace", { x: 1.28, y: 0.44, w: 2.2, h: 0.4, fontFace: HEAD, fontSize: 16, objectName: "!!brand" });
  pg(s, n);
  t(s, eyebrow, { x: 0.6, y: 1.12, w: 7, h: 0.3, fontSize: 12, color: K.gold, bold: true, charSpacing: 4, objectName: "!!eyebrow" });
  if (title) t(s, title, { x: 0.6, y: 1.42, w: 12.1, h: 0.75, fontFace: HEAD, fontSize: 32, objectName: "!!title" });
}
const card = (s, x, y, w, h, name, o = {}) =>
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: K.card }, line: { color: K.line, width: 1 }, objectName: name, ...o });
const ring = (s, x, y, d, label, name, color = K.gold) => {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: K.bg }, line: { color, width: 1.5 }, objectName: name + "_c" });
  t(s, label, { x, y, w: d, h: d, align: "center", valign: "middle", fontFace: HEAD, fontSize: 16, color, objectName: name + "_n" });
};

// ───────────────────────── 1 · Gancho: la España vacía
{
  const s = pres.addSlide({ masterName: "OSCURO" });
  s.addImage({ path: IMG + "campo-oscuro.jpg", x: 0, y: 0, w: W, h: 7.5, objectName: "bgcampo" });
  t(s, "LA ESPAÑA VACÍA", { x: 0.8, y: 1.35, w: 8, h: 0.35, fontSize: 14, color: K.gold, bold: true, charSpacing: 5, objectName: "eyebrow" });
  t(s, "3.834", { x: 0.75, y: 1.85, w: 8, h: 1.6, fontFace: HEAD, fontSize: 110, color: K.gold, objectName: "big" });
  t(s, "municipios de España perdieron población\nsolo en 2023: casi la mitad.", { x: 0.8, y: 3.55, w: 8.5, h: 1.05, fontFace: HEAD, fontSize: 28, lineSpacingMultiple: 1.05, objectName: "what" });
  t(s, "Cuando vivir del campo deja de compensar, el pueblo se vacía.", { x: 0.8, y: 4.95, w: 8.5, h: 0.45, fontSize: 20, color: K.muted, objectName: "why" });
  t(s, "Fuente: INE, Censo Anual de Población a 1 de enero de 2024", { x: 0.8, y: 6.8, w: 8, h: 0.3, fontSize: 11, color: K.dim, objectName: "src" });
  s.addNotes(
    "[≈20 s] Todos hemos oído hablar de la España vacía: pueblos que se quedan sin gente. Solo en 2023, casi la mitad de los municipios de España perdió población. " +
    "Y en el campo suele empezar igual: una sequía, una mala campaña, una decisión equivocada sobre qué sembrar… y vivir de la tierra deja de compensar."
  );
}

// ───────────────────────── 2 · El problema concreto
{
  const s = pres.addSlide({ masterName: "OSCURO" });
  s.addImage({ path: IMG + "mapa-andalucia-oscuro.png", x: 4.3, y: 0, w: 7.5 * 1180 / 720, h: 7.5, objectName: "!!mapa" });
  t(s, "EL PROBLEMA", { x: 0.6, y: 1.12, w: 7, h: 0.3, fontSize: 12, color: K.gold, bold: true, charSpacing: 4, objectName: "eyebrow" });
  t(s, "Sembrar a ciegas\nen plena sequía", { x: 0.6, y: 1.5, w: 6.2, h: 1.6, fontFace: HEAD, fontSize: 44, objectName: "q" });
  t(s, "Cada otoño, el agricultor de secano decide qué sembrar. Se juega la campaña entre agua, suelo y mercado, y los datos de satélite que podrían ayudarle no le llegan.",
    { x: 0.6, y: 3.3, w: 5.4, h: 1.5, fontSize: 17, color: K.muted, lineSpacingMultiple: 1.15, objectName: "body" });
  const st = [["453 mm", "lluvia media\nal año"], ["302 mm", "en 2023: un tercio\nmenos de lluvia"], ["792 mm", "de déficit hídrico\nal año"]];
  st.forEach(([v, l], i) => {
    const x = 0.6 + i * 1.95;
    t(s, v, { x, y: 5.15, w: 1.9, h: 0.6, fontFace: HEAD, fontSize: 30, color: i === 1 ? K.warn : K.gold, objectName: `stat${i}_v` });
    t(s, l, { x, y: 5.8, w: 1.9, h: 0.6, fontSize: 13, color: K.muted, objectName: `stat${i}_l` });
  });
  t(s, "Finca de secano 29:15:2:18, Antequera (Málaga) · clima POWER", { x: 0.6, y: 6.85, w: 6, h: 0.25, fontSize: 10, color: K.dim, objectName: "src" });
  s.addNotes(
    "[≈25 s] Bajemos a una finca real de secano en Antequera, Málaga. Llueven 453 litros al año de media; en 2023, solo 302, un tercio menos. " +
    "Y el cultivo necesitaría casi 800 más de los que caen. Cada otoño el agricultor decide qué sembrar: ¿trigo y girasol otra vez, una leguminosa, barbecho? " +
    "Los datos de satélite existen y son abiertos, pero no le llegan."
  );
}

// ───────────────────────── 3 · La revelación: AgroSpace (marfil)
{
  const s = pres.addSlide({ masterName: "MARFIL" });
  const lw = 7.4, lh = lw * 320 / 1100;
  s.addImage({ path: media("logo-once.gif", "logo-still.png"), x: (W - lw) / 2, y: 1.45, w: lw, h: lh, objectName: "!!logo" });
  t(s, "From territory to farm", { x: 1, y: 3.85, w: W - 2, h: 0.6, align: "center", fontFace: HEAD, fontSize: 30, italic: true, color: K.green, objectName: "tagline" });
  t(s, "Llevamos los datos de satélite a la decisión de cada finca", { x: 1.5, y: 4.55, w: W - 3, h: 0.45, align: "center", fontSize: 20, color: "3E5A45", objectName: "sub" });
  t(s, "Space Apps Challenge 2026  ·  Reto «Field Shift»  ·  Equipo Ciberpiso", { x: 1, y: 6.6, w: W - 2, h: 0.3, align: "center", fontSize: 13, color: "6B7A62", charSpacing: 1, objectName: "event" });
  s.addNotes(
    "[≈10 s] Por eso hemos creado AgroSpace: del territorio a la finca. Lleva los datos de satélite a la decisión de cada agricultor, sin necesitar formación técnica."
  );
}

// ───────────────────────── 4 · Del territorio a tu finca
{
  const s = pres.addSlide({ masterName: "OSCURO" });
  chrome(s, 4, "LA SOLUCIÓN", "Del territorio a tu finca, en cuatro pasos");
  card(s, 6.12, 2.32, 6.66, 4.06, "!!frame");
  s.addImage({ path: media("a-nubes.l.gif", "a-still.png"), x: 6.2, y: 2.4, w: 6.5, h: 6.5 * 720 / 1180, objectName: "!!mapa" });
  t(s, "Andalucía → Málaga: la cámara atraviesa las nubes · demo real", { x: 6.2, y: 6.5, w: 6.5, h: 0.3, fontSize: 11, color: K.dim, objectName: "cap" });
  const steps = [
    ["Andalucía", "2.909.040 fincas SIGPAC en 8 provincias"],
    ["Málaga", "363.401 fincas en 103 municipios"],
    ["Antequera", "14.529 fincas, 26 candidatas"],
    ["Tu finca", "Relieve, suelo, cultivos y 4 rotaciones"],
  ];
  s.addShape(pres.shapes.LINE, { x: 0.6 + 0.29, y: 2.75, w: 0, h: 3.2, line: { color: K.line, width: 1.25 }, objectName: "spine" });
  steps.forEach(([h, d], i) => {
    const y = 2.45 + i * 1.07;
    ring(s, 0.6, y, 0.58, String(i + 1), `step${i}`);
    t(s, h, { x: 1.45, y: y - 0.02, w: 4.3, h: 0.36, fontFace: HEAD, fontSize: 20, objectName: `step${i}_h` });
    t(s, d, { x: 1.45, y: y + 0.36, w: 4.4, h: 0.3, fontSize: 14, color: K.muted, objectName: `step${i}_d` });
  });
  s.addNotes(
    "[≈20 s] Empieza en Andalucía, con casi tres millones de parcelas SIGPAC, y baja como un embudo: Málaga, el municipio y su finca. " +
    "Al entrar en Málaga, la cámara atraviesa las nubes."
  );
}

// ───────────────────────── 5 · Demo 3D
{
  const s = pres.addSlide({ masterName: "OSCURO" });
  chrome(s, 5, "LA DEMO", "Aterriza en tu finca, en 3D");
  const gh = 4.72, gw = gh * 1100 / 720;
  card(s, 0.52, 2.32, gw + 0.16, gh + 0.16, "!!frame");
  s.addImage({ path: media("b-aterrizaje.l.gif", "b-still.png"), x: 0.6, y: 2.4, w: gw, h: gh, objectName: "!!mapa" });
  const pts = [
    ["Relieve real", "Modelo digital del terreno, exagerado ×2"],
    ["Ortofoto real", "La finca tal y como se ve desde el aire"],
    ["Perfil de suelo", "SoilGrids 2.0 en los laterales del bloque"],
    ["Cultivo por campaña", "Visto por MODIS 2020–2025, y la rotación elegida hasta 2031"],
  ];
  pts.forEach(([h, d], i) => {
    const y = 2.45 + i * 1.12;
    ring(s, 8.55, y, 0.5, String(i + 1), `pt${i}`, K.text);
    t(s, h, { x: 9.25, y: y - 0.03, w: 3.55, h: 0.36, fontFace: HEAD, fontSize: 18, objectName: `pt${i}_h` });
    t(s, d, { x: 9.25, y: y + 0.33, w: 3.55, h: 0.6, fontSize: 13, color: K.muted, objectName: `pt${i}_d` });
  });
  s.addNotes(
    "[≈20 s] Y aterriza en su finca en 3D: su relieve real, su ortofoto, el perfil de suelo y los cultivos que el satélite MODIS vio cada campaña desde 2020. " +
    "El agricultor reconoce su tierra al instante."
  );
}

// ───────────────────────── 6 · La decisión (y la prueba de que funciona)
{
  const s = pres.addSlide({ masterName: "OSCURO" });
  chrome(s, 6, "LA DECISIÓN", "Cuatro rotaciones, una recomendación que se explica");
  const R = [
    { code: "R0", name: "Actual · trigo–girasol", score: "67,3", v: [64.8, 67.5, 74.9, 68.2], c: K.cereal },
    { code: "R1", name: "+ garbanzo", score: "70,1", v: [67.2, 75.0, 70.1, 72.8], c: K.legume, best: true },
    { code: "R2", name: "+ veza", score: "69,6", v: [67.2, 78.4, 60.7, 72.8], c: K.legume },
    { code: "R3", name: "+ barbecho", score: "64,1", v: [76.5, 51.7, 49.9, 54.6], c: K.fallow },
  ];
  const labels = ["Agua", "Suelo", "Mercado", "Riesgo"];
  const cw = 2.92, gap = 0.21, y0 = 2.35, ch = 2.62;
  R.forEach((r, i) => {
    const x = 0.6 + i * (cw + gap), p = `card${i}_`;
    card(s, x, y0, cw, ch, p + "bg", r.best ? { line: { color: K.straw, width: 2 } } : {});
    t(s, r.code, { x: x + 0.22, y: y0 + 0.2, w: 0.6, h: 0.3, fontSize: 13, bold: true, color: K.gold, charSpacing: 2, objectName: p + "code" });
    if (r.best) t(s, "★ Mejor para agua", { x: x + 1.05, y: y0 + 0.2, w: 1.7, h: 0.3, fontSize: 11, bold: true, color: K.straw, align: "right", objectName: p + "badge" });
    t(s, r.name, { x: x + 0.22, y: y0 + 0.5, w: cw - 0.4, h: 0.3, fontSize: 14, color: K.muted, objectName: p + "name" });
    s.addShape(pres.shapes.OVAL, { x: x + 0.24, y: y0 + 1.05, w: 0.16, h: 0.16, fill: { color: r.c }, line: { color: r.c, width: 0 }, objectName: p + "dot" });
    t(s, r.score, { x: x + 0.5, y: y0 + 0.82, w: 1.6, h: 0.6, fontFace: HEAD, fontSize: 34, objectName: p + "score" });
    r.v.forEach((v, j) => {
      const yy = y0 + 1.55 + j * 0.25;
      t(s, labels[j], { x: x + 0.22, y: yy, w: 0.8, h: 0.22, fontSize: 11, color: K.muted, objectName: `${p}l${j}` });
      s.addShape(pres.shapes.RECTANGLE, { x: x + 1.02, y: yy + 0.08, w: 1.32, h: 0.07, fill: { color: K.line }, line: { color: K.line, width: 0 }, objectName: `${p}tr${j}` });
      s.addShape(pres.shapes.RECTANGLE, { x: x + 1.02, y: yy + 0.08, w: 1.32 * v / 100, h: 0.07, fill: { color: r.best ? K.straw : K.gold }, line: { width: 0, color: K.gold }, objectName: `${p}b${j}` });
      t(s, v.toFixed(1).replace(".", ","), { x: x + 2.38, y: yy, w: 0.45, h: 0.22, fontSize: 11, color: K.text, align: "right", objectName: `${p}v${j}` });
    });
  });
  // Abajo a la izquierda: la recomendación y lo que explica
  t(s, [
    { text: "Recomendación (prioridad agua): ", options: { bold: true, color: K.gold } },
    { text: "R1 con garbanzo, 70,1 frente a 67,3 de hoy. Gana sobre todo en suelo (+7,5), aunque pierde en mercado (−4,8)." },
  ], { x: 0.6, y: 5.25, w: 7.5, h: 0.75, fontSize: 15, lineSpacingMultiple: 1.1, objectName: "rec" });
  const chips = [["Por qué", K.good], ["Evidencia", K.good], ["Lagunas de datos", K.warn], ["Riesgos a revisar en campo", K.warn]];
  let cx = 0.6;
  chips.forEach(([c, col], i) => {
    const w = 0.42 + c.length * 0.085;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx, y: 6.2, w, h: 0.36, rectRadius: 0.18, fill: { color: K.card }, line: { color: col, width: 1 }, objectName: `chip${i}_bg` });
    t(s, c, { x: cx, y: 6.2, w, h: 0.36, align: "center", valign: "middle", fontSize: 12, color: col, objectName: `chip${i}_t` });
    cx += w + 0.15;
  });
  t(s, "Datos abiertos reales: POWER · MODIS · SoilGrids · WorldCover · SIGPAC · SRTM", { x: 0.6, y: 6.78, w: 7.6, h: 0.3, fontSize: 12, color: K.dim, objectName: "srcs" });
  // Abajo a la derecha: la prueba de que funciona
  card(s, 8.45, 5.17, 4.28, 1.95, "proof_bg", { line: { color: K.good, width: 1 } });
  t(s, "NOTA DE AGUA VALIDADA", { x: 8.7, y: 5.33, w: 3.9, h: 0.25, fontSize: 11, bold: true, color: K.good, charSpacing: 2, objectName: "proof_h" });
  t(s, "0,723", { x: 8.7, y: 5.6, w: 1.9, h: 0.75, fontFace: HEAD, fontSize: 40, color: K.gold, objectName: "proof_v" });
  t(s, "AUC frente a 0,627\ncon solo lluvia", { x: 10.55, y: 5.72, w: 2.1, h: 0.6, fontSize: 13, color: K.text, objectName: "proof_c" });
  t(s, "Detecta las campañas con estrés hídrico (360 temporadas-finca)", { x: 8.7, y: 6.5, w: 3.95, h: 0.45, fontSize: 12, color: K.muted, objectName: "proof_d" });
  s.addNotes(
    "[≈30 s] Para esa finca comparamos la rotación actual con tres alternativas, puntuadas en agua, suelo, mercado y riesgo con reglas explicables. " +
    "Con prioridad agua gana meter garbanzo: 70,1 frente a 67,3, y la herramienta explica por qué, con qué evidencia y qué revisar en campo. " +
    "Todo con datos abiertos reales, y la nota de agua está validada: detecta las campañas con estrés hídrico mejor que la lluvia sola."
  );
}

// ───────────────────────── 7 · Cierre con QR (marfil)
{
  const s = pres.addSlide({ masterName: "MARFIL" });
  const lw = 5.6, lh = lw * 320 / 1100;
  s.addImage({ path: media("logo-once.gif", "logo-still.png"), x: 0.6, y: 0.95, w: lw, h: lh, objectName: "!!logo" });
  t(s, "Escanea y explora\ntu propia finca", { x: 0.75, y: 2.85, w: 6.6, h: 1.35, fontFace: HEAD, fontSize: 36, color: K.green, objectName: "cta" });
  t(s, "Demo en vivo en el navegador, sin instalar nada.", { x: 0.75, y: 4.25, w: 6.6, h: 0.35, fontSize: 16, color: "3E5A45", objectName: "cta2" });
  t(s, "EQUIPO CIBERPISO", { x: 0.75, y: 5.15, w: 6.6, h: 0.3, fontSize: 12, bold: true, color: "6B7A62", charSpacing: 4, objectName: "teamh" });
  t(s, "Gael Espín  ·  Nikhil Baxani  ·  Jesus Rodríguez\nJavier Díaz  ·  Yeray Moraleda",
    { x: 0.75, y: 5.5, w: 6.8, h: 0.8, fontSize: 17, color: K.green, lineSpacingMultiple: 1.2, objectName: "names" });
  t(s, "Space Apps Challenge 2026 · Málaga", { x: 0.75, y: 6.75, w: 6, h: 0.3, fontSize: 12, color: "6B7A62", objectName: "event" });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.15, y: 0.95, w: 4.45, h: 5.6, rectRadius: 0.2, fill: { color: "FFFFFF" }, line: { color: "E8DCC0", width: 1 },
    shadow: { type: "outer", color: "103B2D", opacity: 0.18, blur: 18, offset: 6, angle: 90 }, objectName: "qr_bg" });
  s.addImage({ path: IMG + "qr.png", x: 8.55, y: 1.35, w: 3.65, h: 3.65, objectName: "qr" });
  t(s, "agrospace-w8ej.onrender.com", { x: 8.15, y: 5.3, w: 4.45, h: 0.35, align: "center", fontSize: 16, bold: true, color: K.green, objectName: "url" });
  t(s, "From territory to farm", { x: 8.15, y: 5.72, w: 4.45, h: 0.35, align: "center", fontFace: HEAD, fontSize: 14, italic: true, color: "6B7A62", objectName: "tag" });
  s.addNotes(
    "[≈15 s] Escanead el QR y probadlo en vivo con cualquier finca de Málaga. Que decidir qué sembrar no sea una apuesta. " +
    "Somos el equipo Ciberpiso: Gael, Nikhil, Jesús, Javier y Yeray. Gracias."
  );
}

fs.mkdirSync("build", { recursive: true });
pres.writeFile({ fileName: OUT }).then((f) => console.log("ok", f));
