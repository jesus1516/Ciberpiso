# Guía paso a paso (48 h)

Esta guía asume un equipo de 3–4 personas y un hackathon de fin de semana. Los
tiempos son orientativos; lo importante es el orden y los entregables.

## Regla de oro

No empieces por la UI ni por un modelo de IA. Primero fija el caso de uso, las
rotaciones y los datos. Si el sábado por la tarde no tienes una tabla de rotaciones
con evidencia, la demo será una maqueta.

Cada fase termina con un entregable concreto y un criterio de "hecho". Si no se
cumple, no pases a la siguiente.

---

## Fase 0 — Alcance y caso de uso (2–3 h)

**Objetivo:** elegir un lugar, un perfil de finca y una decisión concreta.

### Tareas

1. **Elige un condado de EE. UU.** Recomendado: centro de Iowa (por ejemplo, Story,
   Boone o Marshall). Motivo: coinciden CDL, SSURGO, PRISM, NAIP y NWIS, y hay señal
   satelital de NASA. No elijas un país sin datos de suelo o cultivo.
2. **Define un perfil de finca.** Ejemplo: 200 ha, secano, suelo franco-limoso,
   rotación maíz–soja, sin ganado, maquinaria para siembra directa.
3. **Define la decisión.** "¿Qué rotación propongo para los próximos 3–4 años si mi
   prioridad es X?" No "predecir el rendimiento".
4. **Fija las restricciones.** Agua disponible, maquinaria, mercado, mano de obra,
   ventana de siembra, tolerancia al riesgo.
5. **Escribe el alcance en una página.** Plantilla:

```text
AOI: bbox y condado
Perfil: superficie, suelo, clima, riego, maquinaria
Rotación actual: ...
Alternativas: ...
Prioridades: agua / suelo / rentabilidad / riesgo
Restricciones: ...
Decisión que apoya: ...
Fuera de alcance: ...
```

### Entregable

`docs/alcance.md` con la plantilla rellena.

### Criterio de hecho

Cualquier miembro del equipo puede explicar en 30 segundos: quién es el usuario, qué
decisión toma y qué tres rotaciones compara.

---

## Fase 1 — Rotaciones y evidencia (3–4 h)

**Objetivo:** convertir la agronomía en una tabla comparable, no en una lista de
eslóganes.

### Tareas

1. **Define la rotación actual.** En Iowa: maíz–soja.
2. **Define tres alternativas.** Una por mecanismo:
   - **Diversidad con cereal pequeño + leguminosa:** maíz–soja–avena + trébol rojo.
   - **Cobertura de invierno:** maíz–soja–trigo + centeno como cubierta.
   - **Leguminosa profunda:** maíz–soja–alfalfa (2–3 años).
3. **Rellena una ficha por rotación** con los cinco campos que exige el reto:
   - Por qué se sugiere.
   - Qué evidencia la respalda (mecanismo + fuente).
   - Qué beneficios ofrece.
   - Dónde hay lagunas de datos.
   - Qué riesgos requieren revisión local.
4. **Separa lo calculable de lo cualitativo.** No inventes un número para el mercado
   o para la ruptura de plagas si no tienes datos.
5. **Usa la plantilla de [rotaciones.md](rotaciones.md).**

### Entregable

Tabla con 4 rotaciones × 5 campos, más una lista de indicadores.

### Criterio de hecho

Cada rotación tiene al menos dos fuentes citadas y una frase honesta de "esto no lo
podemos calcular con los datos disponibles".

---

## Fase 2 — Datos mínimos y acceso (4–6 h)

**Objetivo:** tener un AOI descargado y reproducible, no una lista de enlaces.

### Tareas

1. **Elige el paquete mínimo sin credenciales:**

   | Dato | Fuente | Para qué |
   | --- | --- | --- |
   | Clima diario | NASA POWER | Lluvia, temperatura, heladas, radiación |
   | Suelo | SSURGO vía Soil Data Access | Textura, drenaje, retención de agua |
   | Cobertura del suelo | NLCD | Contexto y línea base |
   | Mapa base y capas | GIBS WMTS | Visualización |
   | Cultivo histórico | CDL | Rotación actual y diversidad |
   | Clima local | PRISM | Contraste con POWER |
   | Agua superficial | NWIS | Contexto de cuenca |

2. **Verifica cada endpoint** con los comandos de [acceso-datos.md](acceso-datos.md).
   Guarda el código HTTP y la fecha.
3. **Descarga el AOI** y guárdalo en `data/raw/{fuente}/`.
4. **Escribe un manifiesto** con URL, fecha, bbox, variable y hash.
5. **No metas secretos en el repo.** Si usas Earthdata, CDS o una API key, usa
   variables de entorno o `~/.netrc`.

### Entregable

`data/raw/` + `data/manifest.json` + un script que reproduzca la descarga.

### Criterio de hecho

Otra persona puede borrar `data/raw/`, ejecutar un comando y obtener los mismos
archivos. Sabes qué está cacheado y qué no.

---

## Fase 3 — Pipeline y armonización (8–10 h)

**Objetivo:** pasar de archivos crudos a indicadores por rotación, con unidades y
procedencia.

### Tareas

1. **Fija una rejilla común.** Para Iowa, `EPSG:5070` (Albers, áreas iguales).
   Resolución:
   - 30 m para suelo, cobertura y pendiente.
   - 250 m para clima agregado.
   - No remuestrees lo fino a lo grueso para "mejorar" el clima; agrega lo grueso
     hacia lo fino solo para visualizar.
2. **Recorta, reproyecta y agrega.** Documenta el método: media ponderada por área,
   vecino más cercano o bilineal. No mezcles métodos sin decirlo.
3. **Calcula indicadores.** Propuesta:

   | Indicador | Cálculo | Fuente | Tipo |
   | --- | --- | --- | --- |
   | Lluvia de temporada | Suma de `PRECTOTCORR`, abr–sep | POWER | Observación modelada |
   | Días de calor | Días con `T2M_MAX` > 32 °C | POWER | Umbral configurable |
   | Días de helada | Días con `T2M_MIN` < 0 °C | POWER | Umbral configurable |
   | Retención de agua | AWC de SSURGO, ponderada por componente | SSURGO | Proxy de suelo |
   | Pendiente | SRTM o 3DEP, media y p90 | SRTM | Observación |
   | Cobertura | Meses con cobertura viva o residuo | CDL/NLCD | Proxy |
   | Diversidad | Índice de Shannon de cultivos en 4 años | CDL | Calculable |
   | Riesgo de erosión | Pendiente × intensidad de lluvia × factor de cobertura | SRTM + POWER | Proxy, no RUSLE |
   | N de leguminosa | Años con leguminosa × crédito local | Rotación + literatura | Cualitativo |
   | Ajuste de mercado | Precio/volumen o respuesta del agricultor | QuickStats/AMS o input | Cualitativo |

4. **Controles de calidad:** unidades, `nodata`, rango, cobertura del AOI y fechas.
5. **Escribe `data/processed/indicators.json`** con un registro por rotación e
   indicador, incluyendo `source`, `date`, `unit` y `confidence`.

### Entregable

Pipeline ejecutable + `indicators.json` + `map.geojson`.

### Criterio de hecho

Cada número de la app se puede rastrear hasta una fuente, una fecha y una fórmula.
Si no puedes explicar un indicador en una frase, elimínalo.

---

## Fase 4 — Modelo de recomendación (6–8 h)

**Objetivo:** ordenar las rotaciones según las prioridades del agricultor, con una
explicación que quepa en una tarjeta.

### Tareas

1. **Empieza con reglas, no con machine learning.** Un modelo de caja negra no se
   puede defender en 48 h.
2. **Normaliza cada indicador a 0–1** entre las rotaciones comparadas. Invierte los
   que sean "menos es mejor" (erosión, días de helada).
3. **Pondera según prioridades.** Ejemplo:

   ```text
   score(rotación) = 0.35·agua + 0.30·suelo + 0.20·rentabilidad + 0.15·riesgo
   ```

   Los pesos salen de los sliders del agricultor y deben sumar 1.
4. **Calcula la confianza** como `cobertura_de_datos × fuerza_de_la_evidencia`.
   Si falta CDL o SSURGO, baja la confianza; no la escondas.
5. **Muestra la contribución de cada indicador.** El usuario debe ver qué empuja la
   recomendación y qué la frena.
6. **Prueba tres perfiles:** prioridad agua, prioridad suelo, prioridad mercado.
   Si el ranking cambia, explica por qué.

### Entregable

Función pura `score(rotation, profile) -> recommendation` con tests.

### Criterio de hecho

Para cada rotación puedes decir: "queda arriba por A y B, baja por C, y hay un dato
que falta: D". Sin esa frase, el modelo no está listo.

---

## Fase 5 — Interfaz (10–12 h)

**Objetivo:** que un agricultor entienda la comparación sin saber qué es un píxel.

### Tareas

1. **Pantalla principal:** mapa a la izquierda, tarjetas de rotación a la derecha.
2. **Barra de prioridades:** agua, suelo, rentabilidad, riesgo. Sliders simples.
3. **Comparación:** selecciona 2–3 rotaciones y muestra una tabla lado a lado.
4. **Ficha de rotación:** los cinco campos obligatorios, siempre visibles:
   - Por qué se sugiere.
   - Evidencia.
   - Beneficios.
   - Lagunas de datos.
   - Riesgos para revisión local.
5. **Glosario en lenguaje llano:** evapotranspiración, NDVI, anomalía, balance
   hídrico, diferencia entre satélite y campo.
6. **Aviso permanente:** "Herramienta de apoyo; no sustituye la revisión local".
7. **Accesibilidad:** teclado, contraste, no depender solo del color, textos
   alternativos en el mapa.
8. **Móvil:** la demo puede hacerse en portátil, pero la ficha debe leerse en móvil.

### Entregable

App desplegada con datos precalculados.

### Criterio de hecho

Una persona ajena al equipo abre la app y explica en menos de 2 minutos por qué una
rotación está por delante de otra.

---

## Fase 6 — Validación y evidencia (3–4 h)

**Objetivo:** saber qué afirmas y qué no.

### Tareas

1. **Prueba de sensibilidad:** mueve los pesos y comprueba si el ranking cambia
   demasiado. Si todo cambia con cualquier ajuste, el modelo es frágil.
2. **Contraste con fuentes locales:** compara lluvia de POWER con PRISM y, si hay,
   con CoCoRaHS. Compara el calendario de cultivos con CDL.
3. **Prueba con dos personas** fuera del equipo. Anota qué no entienden.
4. **Escribe `docs/validacion.md`:** qué se comprobó, qué no, qué falta y qué haría
   falta para validarlo con un agrónomo.
5. **Revisa las afirmaciones.** Cambia "esta rotación reduce la erosión un 30 %" por
   "esta rotación añade cobertura en invierno; el efecto sobre erosión depende de la
   pendiente y del manejo".

### Entregable

`docs/validacion.md` + lista de limitaciones en la app.

### Criterio de hecho

Puedes defender cada número y cada recomendación sin exagerar.

---

## Fase 7 — Demo y entrega (3–4 h)

**Objetivo:** una demo de 3 minutos que funcione sin red.

### Guion

| Tiempo | Qué |
| --- | --- |
| 0:00–0:20 | El problema: decisiones de rotación con datos incompletos. |
| 0:20–0:40 | El usuario y la decisión: finca de Iowa, prioridad agua. |
| 0:40–1:40 | Demo: mapa, prioridades, comparación de 3 rotaciones. |
| 1:40–2:10 | Evidencia: fuente, fecha, beneficio y laguna de cada una. |
| 2:10–2:30 | Incertidumbre y revisión local. |
| 2:30–3:00 | Impacto, límites y siguiente paso. |

### Tareas

1. **Congela los datos.** Tiles, JSON y capturas en local. Nada de APIs en vivo.
2. **Prepara un plan B:** vídeo grabado y capturas si falla el portátil.
3. **Limpia el repo:** README, licencia, créditos, `.env.example`, instrucciones.
4. **Comprueba la checklist de [checklist-evaluacion.md](checklist-evaluacion.md).**
5. **Ensaya dos veces con cronómetro.**

### Criterio de hecho

La demo corre en modo avión y el discurso cubre los cuatro requisitos duros.

---

## Cronograma de 48 h

| Momento | Fase | Entregable |
| --- | --- | --- |
| Viernes noche | 0–1 | Alcance + tabla de rotaciones |
| Sábado mañana | 2 | Datos descargados y cacheados |
| Sábado tarde | 3 | Indicadores y mapa base |
| Sábado noche | 4 | Motor de puntuación con tests |
| Domingo mañana | 5 | UI y fichas |
| Domingo mediodía | 6 | Validación y limitaciones |
| Domingo tarde | 7 | Demo, vídeo y entrega |

## Si el tiempo se acaba

Orden de prioridad:

1. Tres rotaciones con los cinco campos.
2. Mapa con datos reales y procedencia.
3. Comparación explicable.
4. Incertidumbre y revisión local.
5. Todo lo demás: datos en vivo, ML, mercado, animaciones.

Es mejor una demo pequeña y honesta que un dashboard enorme sin evidencia.
