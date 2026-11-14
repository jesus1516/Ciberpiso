# Checklist de evaluación y demo

La organización no publica una rúbrica detallada en la página del reto. Esta lista se
basa en los requisitos del enunciado y en lo que un jurado suele buscar en Space Apps:
problema real, uso sustantivo de datos NASA, rigor, incertidumbre y comunicación.

## Requisitos duros

| Requisito | Dónde se demuestra | Evidencia |
| --- | --- | --- |
| ≥ 3 rotaciones, incluida la actual | Comparación de la app | R0 + R1 + R2 + R3 |
| Por qué se sugiere | Ficha de cada rotación | Frase de mecanismo |
| Evidencia | Ficha + `docs/rotaciones.md` | Fuente y fecha |
| Beneficios | Ficha | 2–4 bullets |
| Lagunas de datos | Ficha + panel de confianza | "Sin datos" explícito |
| Riesgos de revisión local | Ficha | Lista de comprobaciones |
| Herramienta de apoyo | Aviso + lenguaje | "No sustituye..." |
| Usuarios sin formación geoespacial | Glosario + UI | Prueba con 2 personas |
| Prioridades y restricciones | Sliders + perfil | Captura de la demo |

## Checklist de producto

- [ ] Se pueden comparar al menos 3 rotaciones a la vez.
- [ ] La rotación actual está incluida y etiquetada.
- [ ] Cada rotación tiene los cinco campos obligatorios.
- [ ] Cada número tiene fuente, fecha y unidad.
- [ ] Hay un indicador de confianza por recomendación.
- [ ] Las lagunas se muestran, no se esconden.
- [ ] El aviso de revisión local es visible.
- [ ] El glosario explica ET, NDVI, anomalía y balance hídrico.
- [ ] Los sliders cambian el ranking y se ve la contribución.
- [ ] La app funciona en móvil.
- [ ] La app funciona sin red.
- [ ] El mapa tiene leyenda y atribución.

## Checklist de datos

- [ ] El AOI está definido y documentado.
- [ ] Cada archivo está en `manifest.json`.
- [ ] Las fechas y unidades están normalizadas.
- [ ] Los `nodata` están filtrados.
- [ ] La cobertura del AOI está calculada.
- [ ] Hay al menos una validación cruzada (POWER/PRISM, SSURGO/WSS, CDL/NAIP).
- [ ] Las limitaciones están escritas.
- [ ] No hay secretos en el repo.

## Guion de demo (3 minutos)

| Tiempo | Qué decir | Qué mostrar |
| --- | --- | --- |
| 0:00–0:20 | El problema: rotaciones con datos incompletos | Título y una frase |
| 0:20–0:40 | El usuario y la decisión | Perfil de finca |
| 0:40–1:40 | Demo: mapa, prioridades, 3 rotaciones | Comparación |
| 1:40–2:10 | Evidencia y lagunas | Ficha de R1/R2 |
| 2:10–2:30 | Incertidumbre y revisión local | Confianza y avisos |
| 2:30–3:00 | Impacto y siguiente paso | Cierre |

**Consejo:** no leas la pantalla. Cuenta la decisión del agricultor y usa la UI como
prueba.

## Preguntas probables del jurado

**¿Por qué Iowa?**
Porque coinciden datos públicos de cultivo, suelo, clima y agua, y hay señal satelital
de NASA. Es un caso reproducible, no un ejemplo genérico.

**¿Por qué estas rotaciones?**
Cubren tres mecanismos distintos: diversidad con leguminosa, cobertura de invierno y
raíz profunda. La rotación actual es la línea base.

**¿Qué aporta NASA que no aporte un CSV local?**
Series consistentes y comparables de clima, lluvia, humedad y vegetación; además,
permiten escalar a regiones sin datos locales densos.

**¿Cómo manejan los datos faltantes?**
Se muestran como lagunas, bajan la confianza y se convierten en una pregunta para el
agricultor o el agrónomo. No se rellenan con una suposición.

**¿Esto sustituye a un agrónomo?**
No. Ordena opciones y hace explícitos los compromisos; la decisión final es local.

**¿Cómo validaron?**
Contraste de lluvia con PRISM/CoCoRaHS, suelo con WSS, cultivo con NAIP y prueba con
dos personas ajenas al equipo. Lo que no se validó se dice.

**¿Escala?**
El pipeline es reproducible por AOI. La limitación es la disponibilidad de datos
locales (CDL/SSURGO son de EE. UU.); para otros países hay que cambiar de fuente.

**¿Qué harían con más tiempo?**
Validar con un extensionista, añadir ET de OpenET/ECOSTRESS y probar con agricultores
reales.

## Señales de alarma

- "La IA dice que..." sin explicación.
- Precisión falsa: "reduce la erosión un 30 %" sin modelo ni fuente.
- Prometer escala de parcela con SMAP (9 km).
- Ocultar que falta un dato.
- Depender de una API en vivo durante la demo.
- Más funciones que evidencia.
- Un mapa bonito sin tabla de comparación.
- No incluir la rotación actual.

## Checklist de entrega

- [ ] README con propósito, demo y créditos.
- [ ] `docs/` con fuentes, acceso, arquitectura y validación.
- [ ] `resources.json` actualizado.
- [ ] Vídeo de 3 minutos subido.
- [ ] Demo desplegada y probada en modo avión.
- [ ] Repo público o enlace accesible para el jurado.
- [ ] Licencia y atribución de datos.
- [ ] Créditos del equipo.
- [ ] Enlace al reto oficial.

## Última hora

Si queda una hora:

1. Congela los datos.
2. Graba el vídeo.
3. Prueba la demo sin red.
4. Revisa que los cinco campos estén en cada rotación.
5. No añadas features.
