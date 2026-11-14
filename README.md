# Ciberpiso

Herramienta de apoyo a la decisión para explorar **rotaciones de cultivo** con datos
de observación de la Tierra de NASA y contexto local. Proyecto para el **2026 NASA
Space Apps Challenge**, reto [*Field Shift: Adapting Farms with NASA Data*](https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/).

> Estado: calculadora con datos reales para 60 candidatas de Málaga y MVP de frontend
> en [`app/`](app/README.md). La app ya muestra las 26 candidatas de Antequera con las
> cuatro rotaciones calculadas; falta la traducción al inglés y la prueba offline.

## El reto

Los agricultores necesitan elegir rotaciones que protejan el suelo, conserven agua y
resistan eventos extremos, pero cada cultivo tiene compromisos: uno mejora el suelo y
consume demasiada agua, otro abre mercado pero no cabe en la ventana de siembra.

El reto pide una herramienta que combine observaciones de NASA con suelos, cultivos y
prioridades del agricultor para comparar rotaciones. No pide predecir rendimiento ni
sustituir a un agrónomo.

### Ficha del reto

| Campo | Valor |
| --- | --- |
| Evento | 2026 NASA Space Apps Challenge |
| Dificultad | Advanced + Intermediate |
| Materias | Arts & Multimedia, Earth Science, Software |
| Pestañas | Details, Resources, Teams |
| Vídeo | Teaser de 6 s, sin contenido técnico |
| Fechas / rúbrica | No publicadas en la página del reto |

### Requisitos duros

1. Comparar **al menos 3 estrategias de rotación**, incluida la actual.
2. Para cada una, explicar: por qué se sugiere, qué evidencia la respalda, qué
   beneficios ofrece, **dónde faltan datos** y **qué riesgos requieren revisión local**.
3. Ser una herramienta **de apoyo**, no un sustituto del criterio del agricultor.
4. Ser interpretable por usuarios sin formación geoespacial y permitir introducir
   prioridades y restricciones propias (agua, maquinaria, mercado).

## Enfoque actual

- **Caso de uso:** secano de la Campiña de Antequera (Málaga), con 60 parcelas
  candidatas en la provincia y 26 en Antequera. Rotación actual R0 trigo–girasol y
  tres alternativas: R1 +garbanzo, R2 +veza, R3 +barbecho.
- **Datos:** NASA POWER (clima), MODIS MOD13Q1 (NDVI), SoilGrids (suelo), Eurostat
  (precios de trigo, girasol y garbanzo), MAPA (veza grano) y SIGPAC (parcelas).
- **Salida:** `data/processed/indicators.json` con las cuatro rotaciones, evidencia,
  lagunas y riesgos; la app carga las 26 candidatas de Antequera.
- **Modelo:** reglas ponderadas y explicables, no caja negra. La nota de agua está
  validada con NDVI (AUC 0,723) y la confianza baja cuando faltan datos.

## Documentación

| Documento | Qué contiene |
| --- | --- |
| [Plan de acción](docs/plan-de-accion.md) | Rumbo actual: finca de Antequera, cuatro rotaciones y primer paso. |
| [Fuentes scrapeadas](docs/fuentes-scraping.md) | Pipeline de datos de Málaga: fuentes de `resources.md`, CSV, SQLite y lagunas. |
| [Datos](data/README.md) | Dos copias, `data/malaga/` y `data/andalucia/`, con sus CSV, su base SQLite, esquema y consultas. |
| [Guía paso a paso](docs/guia-paso-a-paso.md) | Plan de 48 h, fases, entregables y criterios de "hecho". |
| [Alcance](docs/alcance.md) | Ficha para fijar AOI, perfil, decisión y rotaciones. |
| [Rotaciones de ejemplo](docs/rotaciones.md) | Cuatro estrategias con evidencia, beneficios, lagunas y riesgos. |
| [Fuentes de datos](docs/fuentes-de-datos.md) | Qué ofrece cada fuente, resolución, acceso, uso y límites. |
| [Acceso a datos](docs/acceso-datos.md) | Ejemplos verificados de API, autenticación, caché y armonización. |
| [Arquitectura](docs/arquitectura.md) | Stack, contratos de datos, modelo de puntuación y despliegue. |
| [Validación](docs/validacion.md) | Registro de contrastes, límites y qué falta por validar. |
| [Checklist de evaluación](docs/checklist-evaluacion.md) | Cómo demostrar los requisitos y qué evitar en la demo. |
| [resources.json](resources.json) | Inventario legible por máquina. |

> `resources.md` y `tools_available.md` son listas rápidas del equipo. La referencia
> completa y verificada está en `docs/fuentes-de-datos.md` y `resources.json`.

## Arranque rápido

1. Lee la guía y fija el alcance: un condado, un perfil de finca, tres rotaciones.
2. Verifica el acceso a las fuentes sin credenciales con los comandos de
   `docs/acceso-datos.md`.
3. Descarga y cachea el AOI. No consultes APIs en vivo durante la demo.
4. Calcula los indicadores y guárdalos como JSON/GeoJSON versionado.
5. Construye la UI sobre esos datos; el motor de puntuación debe ser una función pura.
6. Ensaya una demo de 3 minutos sin red.

## Stack recomendado

- **Pipeline:** Python 3.11 + `requests` + `geopandas`/`rioxarray` (solo offline).
- **App:** Next.js + TypeScript + MapLibre GL JS.
- **Datos:** JSON y GeoJSON precalculados; sin backend en la demo.
- **Alternativa rápida:** Streamlit si el equipo es solo Python y prioriza el modelo
  sobre el acabado visual.

## Qué no es

- No es una prescripción agronómica por parcela.
- No sustituye al agricultor, al agrónomo ni a los datos de campo.
- No promete resolución de parcela con SMAP (9 km) ni con POWER (0,5°).
- No es un dashboard de satélite en tiempo real.

## Riesgos y lagunas

- **GRACE** aparece citado en el enunciado sin enlace propio; hay que localizar el
  producto concreto (mascons) y documentarlo. **GEDI** sí tiene enlace en Resources.
- **CDL y SSURGO** solo cubren EE. UU.; para un caso global hay que cambiar a GAEZ y
  a la base armonizada de suelos de FAO.
- **OpenET** solo cubre el oeste de EE. UU.
- **SMAP** tiene 9 km y huecos; no sirve para escala de parcela.
- **GIBS** tiene capas de SMAP/IMERG, pero son PNG de visualización, no datos.
- **Mercado:** QuickStats y AMS requieren key; si no hay, usa un CSV curado con
  precios medios y fuente citada.

## Fuentes y créditos

- Reto oficial: [NASA Space Apps Challenge 2026](https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/).
- Datos: NASA, USDA, USGS, ECMWF/Copernicus y ESA. Cada documento indica la fuente,
  la fecha de verificación y la licencia o condición de uso.
- NASA no respalda entidades no federales; respeta las condiciones de cada sitio.

## Estado

- [x] Investigación del enunciado y de las fuentes.
- [x] Verificación de endpoints sin credenciales.
- [x] Guía, arquitectura y checklist.
- [x] Plan de acción con el nuevo caso de Antequera.
- [ ] Caso de uso y datos del AOI.
- [ ] Pipeline y app.
- [ ] Validación con un agrónomo o extensionista.
