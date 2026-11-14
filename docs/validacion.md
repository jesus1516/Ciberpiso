# Validación y limitaciones

> Validación hecha el 14 de noviembre de 2026 sobre los datos reales de Málaga.
> Solo se valida la nota de agua. Suelo, riesgo y precio siguen siendo reglas
> expertas y no tienen etiqueta independiente con la que contrastarse.

## Qué se comprobó

| Afirmación | Fuente | Método | Resultado | Confianza |
| --- | --- | --- | --- | --- |
| La nota de agua distingue años buenos y malos | NASA POWER + MODIS | 360 finca-campaña, validación dejando un municipio fuera | AUC 0,723; Spearman 0,494 con NDVI jun–ago | Media |
| El déficit hídrico (lluvia − ET0) predice mejor que la lluvia sola | NASA POWER | Comparación con el modelo antiguo | AUC 0,627 → 0,723 | Media |
| El modelo no depende de un municipio concreto | NASA POWER + MODIS | Leave-one-municipality-out (12 municipios) | AUC 0,727 → 0,778 | Media |
| La clase arable del satélite sirve para validar | MODIS | Control negativo | AUC 0,54; sin señal | Baja |
| Suelo, riesgo y precio | — | Sin etiqueta independiente | No validados | Baja |

## Datos de la validación

- **360 filas** = 60 fincas candidatas × 6 campañas (2020–2025).
- **12 municipios**, con Antequera, Campillos, Teba y Fuente de Piedra como grupos
  principales.
- Etiqueta principal: `exito_estival`, NDVI de junio–agosto ≥ 0,33 (44/360, 12 %).
- Control negativo: `clase_arable`, clase herbácea de invierno o verano (219/360, 61 %).
  Es la etiqueta equilibrada, pero **no discrimina**: AUC 0,54. Por eso no se usa para
  calibrar.

## Resultados

Modelo antiguo: la nota de agua dependía solo de la lluvia y se saturaba por encima de
450 mm. Modelo nuevo: usa el déficit hídrico anual (`lluvia − ET0`).

| Métrica | Lluvia | Déficit hídrico |
| --- | --- | --- |
| AUC con `exito_estival` | 0,627 | **0,723** |
| Spearman con NDVI jun–ago | 0,256 | **0,494** |
| Spearman con NDVI máximo | 0,250 | **0,386** |
| AUC dejando un municipio fuera | 0,727 | **0,778** |
| Balanced accuracy dejando un municipio fuera | 0,680 | **0,734** |
| Mejor umbral de éxito | 60,0 | 62,7 |
| Balanced accuracy en ese umbral | 0,622 | **0,689** |

La mejora supera los mínimos fijados de antemano (AUC +0,05, Spearman +0,05 y LOMO
+0,03), así que se adopta el modelo de déficit con referencia de **900 mm**. Esa
referencia solo fija la escala: no se ajusta a la etiqueta y no cambia el orden de las
fincas.

## Auditoría de cumplimiento

`python3 pipeline/audit.py` comprueba la salida completa:

- 60 fincas, 240 rotaciones y 960 indicadores.
- Los cinco campos obligatorios por rotación: por qué, evidencia, beneficios, lagunas
  y riesgos de revisión local.
- Fuente, fecha, unidad, confianza y laguna en cada indicador.
- Rankings coherentes: los empates comparten puesto y las rotaciones con datos
  incompletos no se rankean.
- Aviso de herramienta de apoyo, glosario y fuentes en el JSON.

Resultado actual: **0 fallos**. R1 y R2 ya no son clones: la veza tiene más protección
de erosión y materia orgánica que el garbanzo. R2 sigue sin nota de precio y se muestra
como “no comparable” hasta que exista una serie fiable de veza.

## Decisión sobre los umbrales

Los umbrales de viabilidad se mantienen en **20 (bloqueo) y 40 (aviso)**. El umbral que
maximiza balanced accuracy (62,7) cambiaría con cualquier reescala de la nota, no es
estable entre municipios y la nota no es una probabilidad. Se documenta como diagnóstico,
no se usa como corte.

## Lo que no se validó

- **Suelo:** no hay una etiqueta independiente de calidad del suelo. La fórmula usa
  arcilla, pH y agua disponible, pero no se contrasta con rendimiento.
- **Riesgo:** depende de calor, helada y sequía; no hay serie de daños observados.
- **Precio:** Eurostat da precio nacional anual, no lonja local. Sin rendimientos ni
  costes no se puede validar un margen; la nota se llama “precio/mercado”, no
  rentabilidad.
- **Rotación observada:** `rotacion_estimada` es una estimación NDVI a 250 m, no cultivo
  declarado. No distingue trigo de girasol ni separa R1 de R2.
- **Muestra:** 60 fincas y 44 éxitos estivales. Los intervalos de confianza son anchos;
  los resultados son una señal, no una prueba definitiva.

## Qué falta para una validación real

- Revisión con un agrónomo o extensionista local.
- Datos de manejo: laboreo, variedad, fechas de siembra y cosecha.
- Rendimientos y costes por campaña.
- Cultivo declarado de SIGPAC o una fuente equivalente.
- Medición de campo o sensor local en al menos una campaña.

## Reproducir

```bash
python3 pipeline/prepare_inputs.py   # 360 escenarios
python3 pipeline/calibrate.py        # métricas y decisión
python3 pipeline/calculator.py       # indicators.json
python3 -m unittest discover -s tests -v
```

## Registro

- **Fecha:** 2026-11-14
- **Datos:** 60 candidatas, campañas 2020–2025, Eurostat 2000–2024.
- **Decisión:** adoptar déficit hídrico; mantener umbrales 20/40.
- **Artefactos:** `data/calibration.json`, `data/processed/validation.json`.
