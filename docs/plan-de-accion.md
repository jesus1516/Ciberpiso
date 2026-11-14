# Plan de acción

> Acordado el 14 de noviembre de 2026. Sustituye el caso de Iowa por una finca de
> secano en la Campiña de Antequera (Málaga). Es la referencia para actualizar el
> resto de documentos.

## La idea

El proyecto tiene buena investigación, pero todavía no tiene datos ni aplicación.
Hay que pasar de los documentos a una demostración pequeña.

La herramienta no analiza toda Andalucía: analiza **una finca**. En Antequera, una
finca normal de 150–250 ha tiene entre **5 y 20 parcelas**, algo perfectamente
manejable.

## El caso

Una finca de secano de la Campiña de Antequera, con trigo y girasol. Comparamos
cuatro formas de alternar los cultivos:

| ID | Rotación | Papel |
| --- | --- | --- |
| R0 | Trigo–girasol | La actual |
| R1 | Trigo–girasol–garbanzo | Leguminosa |
| R2 | Trigo–girasol–veza | Cubierta / forraje |
| R3 | Trigo–girasol–barbecho | Conservación de agua |

Para cada una calculamos cuánta agua necesita, cuánto protege el suelo, qué riesgo
tiene en un año seco y qué mercado tiene. Usamos datos de clima de la NASA, el
catálogo público de parcelas y cultivos de Andalucía, mapas de suelo y precios
públicos.

## El resultado

Una página sencilla con cuatro tarjetas, un mapa y una explicación clara de qué
sabemos y qué no. La app funcionaría sin internet durante la demo.

## Primer paso

1. Confirmar la finca de Antequera (150–250 ha, 5–20 parcelas).
2. Descargar el clima y el historial de cultivos.
3. Calcular la tabla de las cuatro rotaciones.
4. Construir la aplicación sobre esa tabla.

## Cambios respecto al plan anterior

- El caso de Iowa pasa a Antequera.
- Las rotaciones de maíz–soja–avena–alfalfa pasan a trigo–girasol y alternativas.
- SSURGO, CDL, PRISM y QuickStats pasan a SIGPAC, suelo de Andalucía o SoilGrids,
  AEMET/SIAR y Lonja/MAPA.
- NASA POWER y GIBS se mantienen.
- La arquitectura, el motor de puntuación y la app se reutilizan.

## Estado

- [ ] Finca y AOI confirmados.
- [ ] Clima e historial de cultivos descargados.
- [ ] Tabla de indicadores calculada.
- [ ] App construida.
- [ ] Demo ensayada sin red.
