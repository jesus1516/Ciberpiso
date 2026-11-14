-- Esquema de la base de datos de Ciberpiso (SQLite).
-- Se carga con: python -m pipeline.cargar_sqlite
-- Cada tabla corresponde a un CSV de data/csv/ con las mismas columnas.
-- Las tablas de clave compuesta usan WITHOUT ROWID: la tabla es su propio índice.

-- @tablas ----------------------------------------------------------------------------

-- Municipios (códigos SIGPAC/Catastro; esqueleto)
CREATE TABLE dim_municipio (
  municipio_key INTEGER PRIMARY KEY,      -- provincia*1000 + municipio
  provincia     INTEGER NOT NULL,
  municipio     INTEGER NOT NULL,
  nombre        TEXT    NOT NULL
);

-- Celdas NASA POWER (MERRA-2 0,5° x 0,625°) con resumen climático 2002–2025
CREATE TABLE dim_celda_power (
  celda_power               INTEGER PRIMARY KEY,
  lat                       REAL NOT NULL,   -- centro de la celda
  lon                       REAL NOT NULL,
  campanas                  INTEGER,
  lluvia_media_mm           REAL,
  lluvia_p20_mm             REAL,            -- año seco (1 de cada 5)
  lluvia_cv                 REAL,
  campana_mas_seca          INTEGER,
  lluvia_min_mm             REAL,
  lluvia_oct_may_media_mm   REAL,
  et0_media_mm              REAL,            -- Hargreaves-Samani
  deficit_medio_mm          REAL,            -- ET0 - lluvia
  dias_calor_may_jun_media  REAL,            -- Tmax >= 32 °C
  dias_calor_jul_ago_media  REAL,            -- Tmax >= 35 °C
  dias_helada_media         REAL,
  dias_helada_mar_abr_media REAL,
  gwetroot_media            REAL,            -- humedad zona radicular (0-1)
  gwetroot_mar_may_media    REAL,
  gwetroot_mar_may_p20      REAL
);

-- Fincas = parcelas SIGPAC (geometría); atributos de NASADEM, WorldCover y MODIS
CREATE TABLE fincas (
  finca_key           INTEGER PRIMARY KEY,   -- provincia*10^8 + orden
  parcela_id          TEXT    NOT NULL UNIQUE, -- prov:mun:agr:zona:pol:parcela (estable)
  municipio_key       INTEGER NOT NULL REFERENCES dim_municipio(municipio_key),
  agregado            INTEGER,
  zona                INTEGER,
  poligono            INTEGER,
  parcela             INTEGER,
  n_recintos          INTEGER,
  superficie_ha       REAL,                  -- área de la geometría
  lon                 REAL,                  -- centroide WGS84
  lat                 REAL,
  celda_power         INTEGER REFERENCES dim_celda_power(celda_power),
  n_pixeles           INTEGER,               -- píxeles de 1/4000° dentro de la finca
  altitud_m           REAL,                  -- NASADEM
  pendiente_pct       REAL,                  -- NASADEM
  wc_arbolado_pct     REAL,                  -- ESA WorldCover 2021
  wc_matorral_pct     REAL,
  wc_pasto_pct        REAL,
  wc_cultivo_pct      REAL,
  wc_urbano_pct       REAL,
  wc_suelo_desnudo_pct REAL,
  wc_agua_pct         REAL,
  cobertura_dominante TEXT,
  rotacion_estimada   TEXT,                  -- MODIS NDVI 2020..2025, p. ej. I-V-I-B-I-V
  n_campanas_invierno INTEGER,
  n_campanas_verano   INTEGER,
  n_campanas_barbecho INTEGER,
  n_campanas_arables  INTEGER,               -- invierno + verano + barbecho
  ndvi_jun_ago_max    REAL,
  es_candidata        INTEGER NOT NULL       -- 1 = parcela arable grande de secano (ver docs)
);

-- Recintos SIGPAC (esqueleto: solo identificador y geometría)
CREATE TABLE recintos (
  recinto_key   INTEGER PRIMARY KEY,
  recinto_id    TEXT    NOT NULL UNIQUE,
  finca_key     INTEGER NOT NULL REFERENCES fincas(finca_key),
  recinto       INTEGER,
  superficie_ha REAL,
  lon           REAL,
  lat           REAL
);

-- Suelo ISRIC SoilGrids 2.0 (250 m) por finca, media ponderada por superficie
CREATE TABLE suelo_fincas (
  finca_key               INTEGER PRIMARY KEY REFERENCES fincas(finca_key),
  arcilla_pct             REAL,              -- 0-30 cm
  arena_pct               REAL,
  cos_gkg                 REAL,              -- carbono orgánico
  gruesos_pct             REAL,              -- elementos gruesos (% vol)
  limo_pct                REAL,
  ph_h2o                  REAL,
  densidad_gcm3           REAL,
  nitrogeno_gkg           REAL,
  cic_cmolkg              REAL,              -- capacidad de intercambio catiónico
  cad_0_100_mm            REAL,              -- agua disponible 0-100 cm (Saxton & Rawls 2006)
  pct_superficie_con_dato REAL
);

-- Fenología MODIS por finca y campaña (oct-sep)
CREATE TABLE fenologia_fincas (
  finca_key      INTEGER NOT NULL REFERENCES fincas(finca_key),
  campana        INTEGER NOT NULL,
  n_compuestos   INTEGER,
  ndvi_media     REAL,
  ndvi_max       REAL,
  mes_ndvi_max   INTEGER,
  ndvi_amplitud  REAL,                       -- p90 - p10
  ndvi_ene_abr   REAL,
  ndvi_jun_ago   REAL,
  ndvi_oct_dic   REAL,                       -- verdor de otoño (cereal: bajo; pasto: alto)
  clase_estimada TEXT,
  PRIMARY KEY (finca_key, campana)
) WITHOUT ROWID;

-- Serie NDVI MODIS (16 días) de las fincas agrícolas grandes
CREATE TABLE ndvi_fincas (
  finca_key INTEGER NOT NULL REFERENCES fincas(finca_key),
  fecha     TEXT    NOT NULL,                -- YYYY-MM-DD (centro del compuesto)
  ndvi      REAL    NOT NULL,
  PRIMARY KEY (finca_key, fecha)
) WITHOUT ROWID;

-- Clima NASA POWER por celda y campaña (oct-sep)
CREATE TABLE clima_anual (
  celda_power         INTEGER NOT NULL REFERENCES dim_celda_power(celda_power),
  campana             INTEGER NOT NULL,
  lluvia_mm           REAL,
  lluvia_oct_may_mm   REAL,
  et0_mm              REAL,
  tmedia_c            REAL,
  tmax_abs_c          REAL,
  tmin_abs_c          REAL,
  dias_calor_may_jun  INTEGER,
  dias_calor_jul_ago  INTEGER,
  dias_helada         INTEGER,
  dias_helada_mar_abr INTEGER,
  radiacion_mj_m2_dia REAL,
  deficit_mm          REAL,
  PRIMARY KEY (celda_power, campana)
) WITHOUT ROWID;

-- Humedad del suelo NASA POWER (MERRA-2, fracción 0-1 de saturación) por celda y campaña
CREATE TABLE suelo_humedad_anual (
  celda_power               INTEGER NOT NULL REFERENCES dim_celda_power(celda_power),
  campana                   INTEGER NOT NULL,
  gwettop_media             REAL,            -- 0-5 cm
  gwetroot_media            REAL,            -- zona radicular
  gwetprof_media            REAL,            -- perfil completo
  gwetroot_mar_may          REAL,
  gwetroot_mar_may_anomalia REAL,            -- respecto a la media de la celda
  gwettop_oct_nov           REAL,            -- tempero en siembra
  gwetroot_min              REAL,
  PRIMARY KEY (celda_power, campana)
) WITHOUT ROWID;

-- Productos con precio (Eurostat apri_ap_crpouta, España)
CREATE TABLE dim_producto_precio (
  producto_codigo TEXT PRIMARY KEY,         -- código Eurostat prod_veg (8 dígitos, con ceros)
  producto        TEXT NOT NULL,            -- nombre en inglés (Eurostat)
  producto_es     TEXT,                     -- nombre en español (productos del caso)
  unidad          TEXT,                     -- unidad del precio: 100 kg, 1000 kg, 100 litres, 100 items
  grupo           TEXT                      -- grupo de rotación (cereal_invierno, girasol…)
);

-- Precio medio anual de venta en España (lo que el Ministerio comunica a Eurostat)
CREATE TABLE precios_anuales (
  producto_codigo TEXT    NOT NULL REFERENCES dim_producto_precio(producto_codigo),
  anio            INTEGER NOT NULL,
  precio_eur      REAL    NOT NULL,         -- € por la unidad del producto
  precio_eur_t    REAL,                     -- € por tonelada (solo productos por peso)
  estado          TEXT,                     -- marca de Eurostat: p = provisional
  PRIMARY KEY (producto_codigo, anio)
) WITHOUT ROWID;

-- Veza grano: serie nacional del MAPA (no existe en Eurostat)
CREATE TABLE precios_veza (
  anio              INTEGER PRIMARY KEY,
  precio_eur_100kg  REAL NOT NULL,
  precio_eur_t      REAL NOT NULL,
  fuente            TEXT NOT NULL,
  url               TEXT NOT NULL,
  nota              TEXT
);

-- @indices ---------------------------------------------------------------------------
CREATE INDEX ix_fincas_municipio  ON fincas(municipio_key);
CREATE INDEX ix_fincas_celda      ON fincas(celda_power);
CREATE INDEX ix_fincas_superficie ON fincas(superficie_ha);
CREATE INDEX ix_fincas_candidata  ON fincas(municipio_key) WHERE es_candidata = 1;
CREATE INDEX ix_recintos_finca    ON recintos(finca_key);
CREATE INDEX ix_fenologia_clase   ON fenologia_fincas(campana, clase_estimada);

-- @vistas ----------------------------------------------------------------------------
CREATE VIEW v_fincas AS
SELECT f.*, m.nombre AS municipio_nombre,
       c.lluvia_media_mm, c.lluvia_p20_mm, c.et0_media_mm, c.deficit_medio_mm,
       c.dias_calor_may_jun_media, c.gwetroot_mar_may_media,
       s.arcilla_pct, s.arena_pct, s.limo_pct, s.cos_gkg, s.ph_h2o, s.cad_0_100_mm
FROM fincas f
JOIN dim_municipio m USING (municipio_key)
LEFT JOIN dim_celda_power c USING (celda_power)
LEFT JOIN suelo_fincas s USING (finca_key);

CREATE VIEW v_candidatas AS
SELECT * FROM v_fincas WHERE es_candidata = 1;

CREATE VIEW v_precios AS
SELECT p.anio, d.producto_codigo, COALESCE(d.producto_es, d.producto) AS producto, d.grupo, d.unidad,
       p.precio_eur, p.precio_eur_t, p.estado
FROM precios_anuales p JOIN dim_producto_precio d USING (producto_codigo);

CREATE VIEW v_precios_veza AS
SELECT anio, precio_eur_100kg, precio_eur_t, fuente, url, nota FROM precios_veza;

CREATE VIEW v_clima_suelo_anual AS
SELECT a.*, s.gwettop_media, s.gwetroot_media, s.gwetprof_media, s.gwetroot_mar_may,
       s.gwetroot_mar_may_anomalia, s.gwettop_oct_nov, s.gwetroot_min
FROM clima_anual a JOIN suelo_humedad_anual s USING (celda_power, campana);
