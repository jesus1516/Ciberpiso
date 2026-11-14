"""Export small summaries of the database for the visual dashboard (JSON {rows, meta}).

Reads data/malaga/database/ciberpiso_malaga.sqlite and writes data/processed/dashboard/*.json. Each
file carries this code and its query in `meta`, so that it can be checked.

Usage:
    python -m pipeline.export_dashboard
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import numpy as np
import pandas as pd

DB = Path("data/malaga/database/ciberpiso_malaga.sqlite")
OUT = Path("data/processed/dashboard")
ANTEQUERA = 29015
CELDA_ANTEQUERA = 254281  # POWER cell (37.0, −4.375) that covers the Campiña de Antequera
REJILLA = 0.025  # degrees, for the crop density map
CODIGO = Path(__file__).read_text(encoding="utf-8")

SQL = {
    "municipios": """
        SELECT m.municipio_key, m.nombre AS municipio, COUNT(*) AS n_fincas,
               ROUND(SUM(f.superficie_ha), 1) AS superficie_ha,
               ROUND(SUM(f.superficie_ha * COALESCE(f.wc_cultivo_pct, 0) / 100), 1) AS cultivo_ha,
               SUM(f.es_candidata) AS candidatas
        FROM fincas f JOIN dim_municipio m USING (municipio_key)
        GROUP BY m.municipio_key, m.nombre ORDER BY cultivo_ha DESC""",
    "candidatas": """
        SELECT f.finca_key, f.parcela_id, m.nombre AS municipio, f.municipio_key,
               ROUND(f.superficie_ha, 1) AS superficie_ha, ROUND(f.altitud_m) AS altitud_m,
               f.pendiente_pct, f.wc_cultivo_pct, f.rotacion_estimada,
               f.n_campanas_invierno, f.n_campanas_verano, f.n_campanas_barbecho,
               s.arcilla_pct, s.ph_h2o, s.cos_gkg, s.cad_0_100_mm,
               ROUND(c.lluvia_media_mm) AS lluvia_media_mm, ROUND(c.lluvia_p20_mm) AS lluvia_p20_mm,
               f.lon, f.lat
        FROM fincas f JOIN dim_municipio m USING (municipio_key)
        LEFT JOIN suelo_fincas s USING (finca_key)
        LEFT JOIN dim_celda_power c USING (celda_power)
        WHERE f.es_candidata = 1 ORDER BY f.superficie_ha DESC""",
    "clima_antequera": f"""
        SELECT a.campana, a.lluvia_mm, a.lluvia_oct_may_mm, a.et0_mm, a.deficit_mm,
               a.dias_calor_may_jun, a.dias_helada, s.gwetroot_mar_may, s.gwetroot_mar_may_anomalia
        FROM clima_anual a JOIN suelo_humedad_anual s USING (celda_power, campana)
        WHERE a.celda_power = {CELDA_ANTEQUERA} ORDER BY a.campana""",
    "rotacion_antequera": f"""
        SELECT fe.campana, fe.clase_estimada AS clase, COUNT(*) AS fincas,
               ROUND(SUM(f.superficie_ha), 1) AS ha
        FROM fenologia_fincas fe JOIN fincas f USING (finca_key)
        WHERE f.municipio_key = {ANTEQUERA} AND f.wc_cultivo_pct >= 50
        GROUP BY fe.campana, fe.clase_estimada ORDER BY fe.campana, fe.clase_estimada""",
    "ndvi_candidatas": f"""
        SELECT n.fecha, n.ndvi FROM ndvi_fincas n JOIN fincas f USING (finca_key)
        WHERE f.es_candidata = 1 AND f.municipio_key = {ANTEQUERA}""",
    "mapa_cultivo": """
        SELECT lon, lat, superficie_ha, COALESCE(wc_cultivo_pct, 0) AS wc_cultivo_pct FROM fincas""",
}


def guardar(nombre: str, df: pd.DataFrame, nota: str | None = None) -> None:
    df = df.replace({np.nan: None})
    meta = [
        {"label": "export_dashboard.py", "value": CODIGO, "type": "code", "lang": "python"},
        {"label": "Consulta", "value": " ".join(SQL[nombre].split()), "type": "code", "lang": "sql"},
        {"label": "Entrada", "value": str(DB)},
    ]
    if nota:
        meta.append({"label": "Cálculo", "value": nota})
    f = OUT / f"{nombre}.json"
    f.write_text(json.dumps({"rows": df.to_dict("records"), "meta": meta}, ensure_ascii=False), encoding="utf-8")
    print(f"  {f.name}: {len(df)} rows, {f.stat().st_size / 1e3:.0f} KB")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB)
    q = lambda n: pd.read_sql(SQL[n], con)  # noqa: E731
    for n in ["municipios", "candidatas", "clima_antequera", "rotacion_antequera"]:
        guardar(n, q(n))

    nd = q("ndvi_candidatas")
    g = nd.groupby("fecha")["ndvi"]
    serie = pd.DataFrame({
        "ndvi_mediana": g.median(), "ndvi_p25": g.quantile(0.25), "ndvi_p75": g.quantile(0.75), "fincas": g.size(),
    }).round(3).reset_index()
    guardar("ndvi_candidatas", serie, "Mediana y cuartiles por fecha del NDVI MODIS de las candidatas de Antequera.")

    m = q("mapa_cultivo")
    m["cx"] = (np.floor(m["lon"] / REJILLA) + 0.5) * REJILLA
    m["cy"] = (np.floor(m["lat"] / REJILLA) + 0.5) * REJILLA
    m["cultivo_ha"] = m["superficie_ha"] * m["wc_cultivo_pct"] / 100
    rej = m.groupby(["cx", "cy"]).agg(superficie_ha=("superficie_ha", "sum"), cultivo_ha=("cultivo_ha", "sum"))
    rej = rej.reset_index().rename(columns={"cx": "lon", "cy": "lat"})
    rej["pct_cultivo"] = (rej["cultivo_ha"] / rej["superficie_ha"] * 100).round(1)
    rej = rej.round({"lon": 4, "lat": 4, "superficie_ha": 1, "cultivo_ha": 1})
    guardar("mapa_cultivo", rej, f"Fincas agregadas en celdas de {REJILLA}° por su centroide; "
                                 "cultivo = superficie × % cultivo de WorldCover.")


if __name__ == "__main__":
    main()
