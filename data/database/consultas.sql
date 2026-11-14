-- Consultas de ejemplo para data/database/ciberpiso.sqlite
-- Ábrelas en DB Browser for SQLite (pestaña "Ejecutar SQL") o con:
--   sqlite3 -header -column data/database/ciberpiso.sqlite < data/database/consultas.sql
-- Cambia el código de finca '29:15:0:0:62:14' (Antequera, 96 ha) por el que quieras.
-- Tablas y columnas: data/database/schema.sql. Fuentes: docs/fuentes-scraping.md.

-- 1. Cuántas filas tiene cada tabla
SELECT 'dim_municipio' AS tabla, COUNT(*) AS filas FROM dim_municipio
UNION ALL SELECT 'dim_celda_power', COUNT(*) FROM dim_celda_power
UNION ALL SELECT 'fincas', COUNT(*) FROM fincas
UNION ALL SELECT 'recintos', COUNT(*) FROM recintos
UNION ALL SELECT 'suelo_fincas', COUNT(*) FROM suelo_fincas
UNION ALL SELECT 'fenologia_fincas', COUNT(*) FROM fenologia_fincas
UNION ALL SELECT 'ndvi_fincas', COUNT(*) FROM ndvi_fincas
UNION ALL SELECT 'clima_anual', COUNT(*) FROM clima_anual
UNION ALL SELECT 'suelo_humedad_anual', COUNT(*) FROM suelo_humedad_anual
UNION ALL SELECT 'dim_producto_precio', COUNT(*) FROM dim_producto_precio
UNION ALL SELECT 'precios_anuales', COUNT(*) FROM precios_anuales;

-- 2. Municipios por superficie de cultivo (WorldCover) y candidatas
SELECT m.nombre AS municipio,
       COUNT(*) AS fincas,
       ROUND(SUM(f.superficie_ha)) AS superficie_ha,
       ROUND(SUM(f.superficie_ha * COALESCE(f.wc_cultivo_pct, 0) / 100)) AS cultivo_ha,
       SUM(f.es_candidata) AS candidatas
FROM fincas f JOIN dim_municipio m USING (municipio_key)
GROUP BY m.nombre
ORDER BY cultivo_ha DESC
LIMIT 15;

-- 3. Candidatas de Antequera con relieve, suelo y clima
SELECT parcela_id, ROUND(superficie_ha, 1) AS ha, pendiente_pct, ROUND(altitud_m) AS altitud_m,
       wc_cultivo_pct, rotacion_estimada,
       arcilla_pct, ph_h2o, cad_0_100_mm,
       ROUND(lluvia_media_mm) AS lluvia_media_mm, ROUND(lluvia_p20_mm) AS lluvia_ano_seco_mm
FROM v_candidatas
WHERE municipio_nombre = 'Antequera'
ORDER BY superficie_ha DESC;

-- 4. Ficha completa de una finca por su código SIGPAC
SELECT * FROM v_fincas WHERE parcela_id = '29:15:0:0:62:14';

-- 5. Recintos (trozos) que forman esa finca
SELECT r.recinto_id, ROUND(r.superficie_ha, 2) AS ha, r.lon, r.lat
FROM recintos r JOIN fincas f USING (finca_key)
WHERE f.parcela_id = '29:15:0:0:62:14'
ORDER BY r.recinto;

-- 6. Historia de la finca por campaña: cultivo estimado, lluvia, calor y humedad del suelo
SELECT fe.campana, fe.clase_estimada, fe.ndvi_max, fe.mes_ndvi_max,
       c.lluvia_mm, c.et0_mm, c.dias_calor_may_jun,
       s.gwetroot_mar_may_anomalia AS humedad_primavera_anomalia
FROM fincas f
JOIN fenologia_fincas fe USING (finca_key)
JOIN clima_anual c ON c.celda_power = f.celda_power AND c.campana = fe.campana
JOIN suelo_humedad_anual s ON s.celda_power = f.celda_power AND s.campana = fe.campana
WHERE f.parcela_id = '29:15:0:0:62:14'
ORDER BY fe.campana;

-- 7. Serie NDVI (cada 16 días) de la finca, para una gráfica
SELECT n.fecha, n.ndvi
FROM ndvi_fincas n JOIN fincas f USING (finca_key)
WHERE f.parcela_id = '29:15:0:0:62:14'
ORDER BY n.fecha;

-- 8. Rotaciones estimadas más frecuentes en fincas de cultivo de Antequera
SELECT rotacion_estimada, COUNT(*) AS fincas, ROUND(SUM(superficie_ha)) AS ha
FROM fincas
WHERE municipio_key = 29015 AND wc_cultivo_pct >= 50 AND superficie_ha >= 2
GROUP BY rotacion_estimada
ORDER BY ha DESC
LIMIT 15;

-- 9. Reparto de clases por campaña en las fincas de cultivo de Antequera (ha)
SELECT fe.campana, fe.clase_estimada, COUNT(*) AS fincas, ROUND(SUM(f.superficie_ha)) AS ha
FROM fenologia_fincas fe JOIN fincas f USING (finca_key)
WHERE f.municipio_key = 29015 AND f.wc_cultivo_pct >= 50
GROUP BY fe.campana, fe.clase_estimada
ORDER BY fe.campana, ha DESC;

-- 10. Años secos en cada celda de clima (lluvia por debajo del percentil 20)
SELECT a.celda_power, d.lat, d.lon, a.campana, a.lluvia_mm, ROUND(d.lluvia_p20_mm) AS umbral_seco_mm
FROM clima_anual a JOIN dim_celda_power d USING (celda_power)
WHERE a.lluvia_mm < d.lluvia_p20_mm
ORDER BY a.celda_power, a.campana;

-- 11. Clima medio de cada celda y cuántas fincas caen en ella
SELECT d.celda_power, d.lat, d.lon, COUNT(f.finca_key) AS fincas,
       ROUND(d.lluvia_media_mm) AS lluvia_media_mm, ROUND(d.lluvia_p20_mm) AS lluvia_p20_mm,
       ROUND(d.et0_media_mm) AS et0_mm, ROUND(d.dias_calor_may_jun_media, 1) AS dias_calor_may_jun,
       ROUND(d.dias_helada_media, 1) AS dias_helada
FROM dim_celda_power d LEFT JOIN fincas f USING (celda_power)
GROUP BY d.celda_power
ORDER BY fincas DESC;

-- 12. Ejemplo de filtro: fincas de cultivo grandes, llanas y con buen agua disponible
SELECT parcela_id, municipio_nombre, ROUND(superficie_ha, 1) AS ha, pendiente_pct,
       arcilla_pct, cad_0_100_mm, rotacion_estimada
FROM v_fincas
WHERE superficie_ha >= 30 AND wc_cultivo_pct >= 70 AND pendiente_pct <= 8 AND cad_0_100_mm >= 125
ORDER BY cad_0_100_mm DESC
LIMIT 20;

-- 13. Precios de los cultivos de las rotaciones del caso (€/t), desde 2015
SELECT anio, producto, precio_eur_t, estado
FROM v_precios
WHERE producto IN ('Trigo duro', 'Trigo blando', 'Cebada', 'Girasol', 'Garbanzo', 'Guisante seco')
  AND anio >= 2015
ORDER BY producto, anio;

-- 14. Precio medio, mínimo y máximo 2015–2024 de cada cultivo herbáceo (€/t)
SELECT producto, grupo, COUNT(*) AS anios,
       ROUND(AVG(precio_eur_t)) AS media_eur_t, MIN(precio_eur_t) AS min_eur_t, MAX(precio_eur_t) AS max_eur_t
FROM v_precios
WHERE grupo IN ('cereal_invierno', 'girasol', 'leguminosa_grano', 'oleaginosa_otra') AND anio BETWEEN 2015 AND 2024
GROUP BY producto, grupo
ORDER BY grupo, media_eur_t DESC;

-- 15. Precio de cada cultivo frente a la lluvia de la campaña en Antequera (año seco = precio alto?)
SELECT c.campana, c.lluvia_mm,
       MAX(CASE WHEN v.producto = 'Trigo duro' THEN v.precio_eur_t END) AS trigo_duro_eur_t,
       MAX(CASE WHEN v.producto = 'Girasol' THEN v.precio_eur_t END) AS girasol_eur_t,
       MAX(CASE WHEN v.producto = 'Garbanzo' THEN v.precio_eur_t END) AS garbanzo_eur_t
FROM clima_anual c LEFT JOIN v_precios v ON v.anio = c.campana
WHERE c.celda_power = 254281
GROUP BY c.campana, c.lluvia_mm
ORDER BY c.campana;
