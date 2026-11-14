#!/usr/bin/env python3
"""Construye la tabla de escenarios finca x campana para la calculadora.

Une las 60 fincas candidatas con su clima, suelo, fenologia y precios. El resultado
es un CSV intermedio (data/processed/scenarios.csv) y un informe de calidad
(data/processed/scenarios_qa.json). Solo usa la biblioteca estandar.

Uso:
    python3 pipeline/prepare_inputs.py
"""

from __future__ import annotations

import argparse
import csv
import json
import sqlite3
from collections import Counter
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "data" / "database" / "ciberpiso.sqlite"
OUT_PATH = BASE_DIR / "data" / "processed" / "scenarios.csv"
QA_PATH = BASE_DIR / "data" / "processed" / "scenarios_qa.json"

CAMPANA_MIN = 2020
CAMPANA_MAX = 2025

SQL = """
SELECT
    f.finca_key,
    f.parcela_id,
    f.municipio_nombre AS municipio,
    f.superficie_ha,
    f.lon,
    f.lat,
    f.celda_power,
    f.pendiente_pct,
    f.altitud_m,
    f.wc_cultivo_pct,
    f.rotacion_estimada,
    f.lluvia_media_mm          AS clima_lluvia_media_mm,
    f.lluvia_p20_mm            AS clima_lluvia_p20_mm,
    f.et0_media_mm             AS clima_et0_media_mm,
    f.deficit_medio_mm         AS clima_deficit_medio_mm,
    f.dias_calor_may_jun_media AS clima_dias_calor_may_jun_media,
    f.gwetroot_mar_may_media   AS clima_gwetroot_mar_may_media,
    f.arcilla_pct              AS suelo_arcilla_pct,
    f.limo_pct                 AS suelo_limo_pct,
    f.arena_pct                AS suelo_arena_pct,
    f.ph_h2o                   AS suelo_ph_h2o,
    f.cad_0_100_mm             AS suelo_cad_0_100_mm,
    f.cos_gkg                  AS suelo_cos_gkg,
    fen.campana,
    fen.n_compuestos,
    fen.ndvi_media,
    fen.ndvi_max,
    fen.mes_ndvi_max,
    fen.ndvi_amplitud,
    fen.ndvi_ene_abr,
    fen.ndvi_jun_ago,
    fen.ndvi_oct_dic,
    fen.clase_estimada,
    ca.lluvia_mm,
    ca.lluvia_oct_may_mm,
    ca.et0_mm,
    ca.tmedia_c,
    ca.tmax_abs_c,
    ca.tmin_abs_c,
    ca.dias_calor_may_jun,
    ca.dias_calor_jul_ago,
    ca.dias_helada,
    ca.dias_helada_mar_abr,
    ca.radiacion_mj_m2_dia,
    ca.deficit_mm,
    sh.gwettop_media,
    sh.gwetroot_media,
    sh.gwetprof_media,
    sh.gwetroot_mar_may,
    sh.gwetroot_mar_may_anomalia,
    sh.gwettop_oct_nov,
    sh.gwetroot_min,
    pt.precio_eur_t  AS precio_trigo_eur_t,
    pg.precio_eur_t  AS precio_girasol_eur_t,
    pga.precio_eur_t AS precio_garbanzo_eur_t,
    pgu.precio_eur_t AS precio_guisante_referencia_eur_t,
    pve.precio_eur_t AS precio_veza_eur_t
FROM fenologia_fincas fen
JOIN v_candidatas f ON f.finca_key = fen.finca_key
LEFT JOIN clima_anual ca
       ON ca.celda_power = f.celda_power AND ca.campana = fen.campana
LEFT JOIN suelo_humedad_anual sh
       ON sh.celda_power = f.celda_power AND sh.campana = fen.campana
LEFT JOIN precios_anuales pt
       ON pt.producto_codigo = '01110000' AND pt.anio = fen.campana
LEFT JOIN precios_anuales pg
       ON pg.producto_codigo = '02120000' AND pg.anio = fen.campana
LEFT JOIN precios_anuales pga
       ON pga.producto_codigo = '02992000' AND pga.anio = fen.campana
LEFT JOIN precios_anuales pgu
       ON pgu.producto_codigo = '02210000' AND pgu.anio = fen.campana
LEFT JOIN precios_veza pve
       ON pve.anio = fen.campana
WHERE fen.campana BETWEEN ? AND ?
ORDER BY f.finca_key, fen.campana
"""

CAMPOS = [
    "finca_key",
    "parcela_id",
    "municipio",
    "superficie_ha",
    "lon",
    "lat",
    "celda_power",
    "pendiente_pct",
    "altitud_m",
    "wc_cultivo_pct",
    "rotacion_estimada",
    "clima_lluvia_media_mm",
    "clima_lluvia_p20_mm",
    "clima_et0_media_mm",
    "clima_deficit_medio_mm",
    "clima_dias_calor_may_jun_media",
    "clima_gwetroot_mar_may_media",
    "suelo_arcilla_pct",
    "suelo_limo_pct",
    "suelo_arena_pct",
    "suelo_ph_h2o",
    "suelo_cad_0_100_mm",
    "suelo_cos_gkg",
    "campana",
    "n_compuestos",
    "ndvi_media",
    "ndvi_max",
    "mes_ndvi_max",
    "ndvi_amplitud",
    "ndvi_ene_abr",
    "ndvi_jun_ago",
    "ndvi_oct_dic",
    "clase_estimada",
    "exito_estival",
    "clase_arable",
    "lluvia_mm",
    "lluvia_oct_may_mm",
    "et0_mm",
    "tmedia_c",
    "tmax_abs_c",
    "tmin_abs_c",
    "dias_calor_may_jun",
    "dias_calor_jul_ago",
    "dias_helada",
    "dias_helada_mar_abr",
    "radiacion_mj_m2_dia",
    "deficit_mm",
    "gwettop_media",
    "gwetroot_media",
    "gwetprof_media",
    "gwetroot_mar_may",
    "gwetroot_mar_may_anomalia",
    "gwettop_oct_nov",
    "gwetroot_min",
    "precio_trigo_eur_t",
    "precio_girasol_eur_t",
    "precio_garbanzo_eur_t",
    "precio_veza_eur_t",
    "precio_guisante_referencia_eur_t",
    "precio_barbecho_eur_t",
    "precio_anio",
    "precio_completo_r0",
    "precio_completo_r1",
    "precio_completo_r2",
    "precio_completo_r3",
]

CRITICOS = [
    "finca_key",
    "campana",
    "ndvi_jun_ago",
    "ndvi_max",
    "clase_estimada",
    "suelo_arcilla_pct",
    "suelo_limo_pct",
    "suelo_arena_pct",
    "suelo_ph_h2o",
    "lluvia_mm",
    "lluvia_oct_may_mm",
    "et0_mm",
    "deficit_mm",
    "gwetroot_mar_may",
    "gwettop_media",
]

RANGOS = {
    "ndvi_media": (0.0, 1.0),
    "ndvi_max": (0.0, 1.0),
    "ndvi_jun_ago": (0.0, 1.0),
    "ndvi_ene_abr": (0.0, 1.0),
    "ndvi_oct_dic": (0.0, 1.0),
    "suelo_arcilla_pct": (0.0, 100.0),
    "suelo_limo_pct": (0.0, 100.0),
    "suelo_arena_pct": (0.0, 100.0),
    "suelo_ph_h2o": (3.0, 10.0),
    "superficie_ha": (0.0, 10_000.0),
    "pendiente_pct": (0.0, 100.0),
    "altitud_m": (0.0, 3_000.0),
    "lluvia_mm": (0.0, 3_000.0),
    "et0_mm": (0.0, 3_000.0),
    "deficit_mm": (0.0, 5_000.0),
}


def conectar(db: Path) -> sqlite3.Connection:
    if not db.exists():
        raise FileNotFoundError(
            f"No existe {db}. Genera la base con: python3 pipeline/cargar_sqlite.py"
        )
    con = sqlite3.connect(db)
    con.row_factory = sqlite3.Row
    return con


def build_scenarios(db: Path = DB_PATH) -> list[dict]:
    """Devuelve las 60 candidatas x 6 campanas con clima, suelo y precios."""
    con = conectar(db)
    try:
        filas = [dict(r) for r in con.execute(SQL, (CAMPANA_MIN, CAMPANA_MAX))]
    finally:
        con.close()

    for fila in filas:
        trigo = fila["precio_trigo_eur_t"]
        girasol = fila["precio_girasol_eur_t"]
        garbanzo = fila["precio_garbanzo_eur_t"]
        veza = fila["precio_veza_eur_t"]
        ndvi_jun = fila["ndvi_jun_ago"]

        fila["precio_barbecho_eur_t"] = 0.0
        fila["precio_anio"] = fila["campana"] if trigo is not None else None
        fila["exito_estival"] = int(ndvi_jun >= 0.33) if ndvi_jun is not None else None
        fila["clase_arable"] = int(
            fila["clase_estimada"] in ("herbaceo_invierno", "herbaceo_verano")
        )
        fila["precio_completo_r0"] = int(trigo is not None and girasol is not None)
        fila["precio_completo_r1"] = int(
            trigo is not None and girasol is not None and garbanzo is not None
        )
        fila["precio_completo_r2"] = int(
            trigo is not None and girasol is not None and veza is not None
        )
        fila["precio_completo_r3"] = 1  # el barbecho no necesita precio
    return [{k: fila.get(k) for k in CAMPOS} for fila in filas]


def resumen_calidad(filas: list[dict]) -> dict:
    """Comprueba conteos, nulos criticos, rangos y cobertura de precios."""
    qa = {
        "filas": len(filas),
        "fincas": len({f["finca_key"] for f in filas}),
        "campanas": dict(sorted(Counter(f["campana"] for f in filas).items())),
        "duplicados": len(filas) - len({(f["finca_key"], f["campana"]) for f in filas}),
        "nulos_criticos": {
            k: sum(1 for f in filas if f[k] is None or f[k] == "") for k in CRITICOS
        },
        "rangos": {},
        "precios": {
            "trigo": sum(1 for f in filas if f["precio_trigo_eur_t"] is not None),
            "girasol": sum(1 for f in filas if f["precio_girasol_eur_t"] is not None),
            "garbanzo": sum(1 for f in filas if f["precio_garbanzo_eur_t"] is not None),
            "veza": sum(1 for f in filas if f["precio_veza_eur_t"] is not None),
            "guisante_referencia": sum(
                1 for f in filas if f["precio_guisante_referencia_eur_t"] is not None
            ),
            "barbecho": sum(1 for f in filas if f["precio_barbecho_eur_t"] is not None),
            "anios_con_precio": sorted(
                {f["precio_anio"] for f in filas if f["precio_anio"] is not None}
            ),
            "r0_completo": sum(f["precio_completo_r0"] for f in filas),
            "r1_completo": sum(f["precio_completo_r1"] for f in filas),
            "r2_completo": sum(f["precio_completo_r2"] for f in filas),
            "r3_completo": sum(f["precio_completo_r3"] for f in filas),
        },
        "notas": [
            "exito_estival = 1 si ndvi_jun_ago >= 0,33 (regla de cultivo herbaceo).",
            "clase_arable = 1 si clase_estimada es herbaceo_invierno o herbaceo_verano.",
            "precio_anio = campana; 2025 no tiene precio Eurostat (serie hasta 2024).",
            "Veza usa la serie nacional del MAPA (2014-2024); no hay precio de lonja local.",
            "El barbecho no genera ingreso: precio 0 por definicion.",
            "La rotacion observada es una estimacion NDVI, no cultivo declarado.",
        ],
    }

    for campo, (lo, hi) in RANGOS.items():
        valores = [f[campo] for f in filas if f[campo] is not None]
        qa["rangos"][campo] = {
            "min": min(valores) if valores else None,
            "max": max(valores) if valores else None,
            "fuera_de_rango": sum(1 for v in valores if not lo <= v <= hi),
        }
    return qa


def errores(qa: dict) -> list[str]:
    fallos = []
    if qa["filas"] != 360:
        fallos.append(f"se esperaban 360 filas, hay {qa['filas']}")
    if qa["fincas"] != 60:
        fallos.append(f"se esperaban 60 fincas, hay {qa['fincas']}")
    if qa["duplicados"]:
        fallos.append(f"{qa['duplicados']} duplicados finca-campana")
    for campo, n in qa["nulos_criticos"].items():
        if n:
            fallos.append(f"{n} nulos en {campo}")
    for campo, r in qa["rangos"].items():
        if r["fuera_de_rango"]:
            fallos.append(f"{r['fuera_de_rango']} valores fuera de rango en {campo}")
    return fallos


def escribir(filas: list[dict], qa: dict, out: Path, qa_path: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=CAMPOS)
        writer.writeheader()
        writer.writerows({k: f.get(k) for k in CAMPOS} for f in filas)
    qa_path.write_text(
        json.dumps(qa, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def main() -> None:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--db", type=Path, default=DB_PATH)
    ap.add_argument("--out", type=Path, default=OUT_PATH)
    ap.add_argument("--qa", type=Path, default=QA_PATH)
    args = ap.parse_args()

    filas = build_scenarios(args.db)
    qa = resumen_calidad(filas)
    fallos = errores(qa)
    escribir(filas, qa, args.out, args.qa)

    print(
        f"{qa['filas']} filas, {qa['fincas']} fincas, campanas {min(qa['campanas'])}-{max(qa['campanas'])}"
    )
    p = qa["precios"]
    print(
        f"Precios: trigo {p['trigo']}/360, girasol {p['girasol']}/360, garbanzo {p['garbanzo']}/360, veza {p['veza']}/360"
    )
    print(
        f"Rotaciones con precio completo: R0 {p['r0_completo']}, R1 {p['r1_completo']}, R2 {p['r2_completo']}, R3 {p['r3_completo']}"
    )
    print(f"-> {args.out.relative_to(BASE_DIR)}")
    print(f"-> {args.qa.relative_to(BASE_DIR)}")

    if fallos:
        print("\nQA FALLIDA:")
        for fallo in fallos:
            print(f"  - {fallo}")
        raise SystemExit(1)
    print("QA OK")


if __name__ == "__main__":
    main()
