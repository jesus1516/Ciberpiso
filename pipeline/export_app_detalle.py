"""Real data of each farm for the app (app/public/data/detalle/).

The app draws the farms with pipeline.export_app_fincas; this script gives it what is
shown when analysing one: relief, cover (WorldCover), soil (SoilGrids), phenology
and NDVI series (MODIS), and the observed rotation. It writes one compressed JSON per
municipality (the app only downloads that of the farm's municipality) and a common JSON
of the province with the climate and soil moisture of each POWER cell and the prices of
the crops in the app catalogue.

Usage:
    python -m pipeline.export_app_detalle                # Málaga (29)
    python -m pipeline.export_app_detalle --provincia 29

Output:
    app/public/data/detalle/{municipio_key}.json.gz
    app/public/data/comun_{provincia}.json
"""

from __future__ import annotations

import argparse
import gzip
import json
import math

import pandas as pd

from pipeline.common import ROOT
from pipeline.export_app_fincas import SALIDA, _csv_provincia

WC = ["arbolado", "matorral", "pasto", "cultivo", "urbano", "suelo_desnudo", "agua"]
SUELO = ["arcilla_pct", "arena_pct", "limo_pct", "cos_gkg", "ph_h2o", "densidad_gcm3", "nitrogeno_gkg",
         "cic_cmolkg", "cad_0_100_mm", "gruesos_pct", "pct_superficie_con_dato"]
FENOLOGIA = ["campana", "ndvi_media", "ndvi_max", "mes_ndvi_max", "ndvi_amplitud", "ndvi_ene_abr", "ndvi_jun_ago",
             "ndvi_oct_dic", "clase_estimada"]
# Crop of the app catalogue -> price code (Eurostat apri_ap_crpouta). Vetch uses MAPA.
PRECIOS = {
    "wheat": "01110000", "barley": "01300000", "corn": "01500000", "sunflower": "02120000",
    "chickpea": "02992000", "faba": "02230000", "rye": "01200000", "canola": "02110000",
    "sorghum": "01910000", "olive": "06590000", "almond": "06194130",
}
ANIOS_PRECIO = 5


def _limpio(v):
    if isinstance(v, float) and math.isnan(v):
        return None
    if hasattr(v, "item"):
        return _limpio(v.item())
    return v


def _registro(row, cols):
    return {c: _limpio(row[c]) for c in cols}


def _comun(csv, celdas) -> dict:
    comun = csv.parent / "comun"
    dim = pd.read_csv(comun / "dim_celda_power.csv")
    clima = pd.read_csv(comun / "clima_anual.csv").merge(
        pd.read_csv(comun / "suelo_humedad_anual.csv"), on=["celda_power", "campana"], how="left")
    salida = {"celdas": {}, "precios": {}}
    for _, c in dim[dim["celda_power"].isin(celdas)].iterrows():
        filas = clima[clima["celda_power"] == c["celda_power"]].sort_values("campana")
        salida["celdas"][str(int(c["celda_power"]))] = {
            "resumen": _registro(c, [k for k in dim.columns if k != "celda_power"]),
            "campanas": [_registro(r, [k for k in clima.columns if k != "celda_power"]) for _, r in filas.iterrows()],
        }

    precios = pd.read_csv(comun / "precios_anuales.csv", dtype={"producto_codigo": str}).dropna(subset=["precio_eur_t"])
    nombres = pd.read_csv(comun / "dim_producto_precio.csv", dtype={"producto_codigo": str}).set_index("producto_codigo")
    for cultivo, codigo in PRECIOS.items():
        serie = precios[precios["producto_codigo"] == codigo].sort_values("anio").tail(ANIOS_PRECIO)
        if serie.empty:
            continue
        salida["precios"][cultivo] = {
            "producto": nombres.loc[codigo, "producto_es"] if isinstance(nombres.loc[codigo, "producto_es"], str) else nombres.loc[codigo, "producto"],
            "fuente": "Eurostat apri_ap_crpouta",
            "serie": [[int(r["anio"]), float(r["precio_eur_t"])] for _, r in serie.iterrows()],
        }
    veza = pd.read_csv(comun / "precios_veza.csv").sort_values("anio").tail(ANIOS_PRECIO)
    salida["precios"]["vetch"] = {
        "producto": "Veza grano",
        "fuente": "MAPA Anuario de Estadística 2025, tabla 7.2.7.2",
        "serie": [[int(r["anio"]), float(r["precio_eur_t"])] for _, r in veza.iterrows()],
    }
    return salida


def exportar(prov: int) -> None:
    csv = _csv_provincia(prov)
    fincas = pd.read_csv(csv / "fincas.csv")
    suelo = pd.read_csv(csv / "suelo_fincas.csv").set_index("finca_key")
    feno = pd.read_csv(csv / "fenologia_fincas.csv").sort_values(["finca_key", "campana"])
    ndvi = pd.read_csv(csv / "ndvi_fincas.csv").sort_values(["finca_key", "fecha"])
    feno_por_finca = {k: [_registro(r, FENOLOGIA) for _, r in g.iterrows()] for k, g in feno.groupby("finca_key")}
    ndvi_por_finca = {k: [[f, _limpio(v)] for f, v in zip(g["fecha"], g["ndvi"])] for k, g in ndvi.groupby("finca_key")}

    carpeta = SALIDA / "detalle"
    carpeta.mkdir(parents=True, exist_ok=True)
    for old in carpeta.glob(f"{prov:02d}*.json.gz"):
        old.unlink()
    total = 0
    for mun, g in fincas.groupby("municipio_key"):
        datos = {}
        for _, f in g.iterrows():
            k = int(f["finca_key"])
            datos[str(k)] = {
                "recintos": int(f["n_recintos"]),
                "celda": int(f["celda_power"]),
                "altitud_m": _limpio(f["altitud_m"]),
                "pendiente_pct": _limpio(f["pendiente_pct"]),
                "cobertura": {c: _limpio(f[f"wc_{c}_pct"]) for c in WC},
                "cobertura_dominante": _limpio(f["cobertura_dominante"]),
                "rotacion_estimada": _limpio(f["rotacion_estimada"]),
                "campanas": {c: _limpio(f[f"n_campanas_{c}"]) for c in ["invierno", "verano", "barbecho", "arables"]},
                "ndvi_jun_ago_max": _limpio(f["ndvi_jun_ago_max"]),
                "candidata": int(f["es_candidata"]),
                "suelo": _registro(suelo.loc[k], SUELO) if k in suelo.index else None,
                "fenologia": feno_por_finca.get(k, []),
                "ndvi": ndvi_por_finca.get(k, []),
            }
        destino = carpeta / f"{mun}.json.gz"
        cuerpo = json.dumps(datos, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        destino.write_bytes(gzip.compress(cuerpo, compresslevel=9, mtime=0))
        total += destino.stat().st_size

    comun = SALIDA / f"comun_{prov:02d}.json"
    comun.write_text(json.dumps(_comun(csv, fincas["celda_power"].unique()), ensure_ascii=False, separators=(",", ":")),
                     encoding="utf-8")
    print(f"{len(fincas):,} farms in {fincas['municipio_key'].nunique()} municipalities -> "
          f"{carpeta.relative_to(ROOT)}/ ({total / 1e6:.1f} MB compressed)")
    print(f"Climate, moisture and prices -> {comun.relative_to(ROOT)} ({comun.stat().st_size / 1e3:.0f} kB)")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--provincia", type=int, default=29)
    exportar(ap.parse_args().provincia)


if __name__ == "__main__":
    main()
