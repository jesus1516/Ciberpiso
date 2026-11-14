"""Construye el modelo en estrella y exporta CSV listos para cargar en una base de datos.

Todo el contenido temático sale de fuentes de resources.md:
    NASA POWER            clima y humedad del suelo (pipeline.power)
    Planetary Computer    NASADEM, ESA WorldCover, MODIS NDVI (pipeline.pc)
SIGPAC solo aporta el esqueleto: identificador, municipio y geometría de cada finca.

Salida: data/csv/*.csv, UTF-8, coma, punto decimal, NULL = vacío, ordenados
por clave primaria. El esquema SQL está en data/database/schema.sql.

Claves:
    finca_key     = provincia * 10^8 + orden por código SIGPAC (parcela)
    recinto_key   = provincia * 10^8 + orden por código SIGPAC
    municipio_key = provincia * 1000 + municipio
    celda_power   = índice de la celda MERRA-2 (ver pipeline.power.celda)
Las claves enteras sirven para JOIN rápidos dentro de una versión de los datos; el
identificador estable entre versiones es el código SIGPAC (`parcela_id`, `recinto_id`).

Uso:
    python -m pipeline.build --provincias 29
"""

from __future__ import annotations

import argparse
import json

import numpy as np
import pandas as pd
import pyogrio

from pipeline.common import CSV_DIR, PROCESSED, RAW
from pipeline.power import celda
from pipeline.sigpac import cargar_esqueleto, gpkg_de

CSV = CSV_DIR
GEO = PROCESSED / "geo"
GEO_COLS = ["parcela_id", "municipio_key", "superficie_ha", "altitud_m", "pendiente_pct", "wc_cultivo_pct",
            "rotacion_estimada", "celda_power"]
PC = PROCESSED / "pc"
POWER = PROCESSED / "power"
COD = RAW / "sigpac" / "codigos"
WC = ["arbolado", "matorral", "pasto", "cultivo", "urbano", "suelo_desnudo", "agua"]
LETRA = {"herbaceo_invierno": "I", "herbaceo_verano": "V", "barbecho_o_pastizal": "B", "permanente": "P",
         "sin_vegetacion": "S", "mixto": "M", "sin_datos": "?"}
SUELO_COLS = ["gwettop_media", "gwetroot_media", "gwetprof_media", "gwetroot_mar_may", "gwetroot_mar_may_anomalia",
              "gwettop_oct_nov", "gwetroot_min"]
# Fincas con fenología (MODIS 250 m ≈ 6 ha: por debajo de 2 ha el píxel es casi todo vecino)
FENO_MIN_HA = 2.0
# Serie NDVI completa solo para fincas agrícolas grandes (para gráficas de la app)
SERIE_MIN_HA, SERIE_MIN_CULTIVO = 10.0, 50.0
# Candidata a "finca del caso" (secano de campiña). El plan habla de una explotación de
# 150–250 ha en 5–20 parcelas, pero sin el cultivo declarado de SIGPAC (fuera de
# resources.md) no se pueden agrupar parcelas en explotaciones: se buscan parcelas
# arables grandes. Clases arables: I (invierno), V (verano), B (barbecho/cultivo débil).
CANDIDATA = dict(sup_min=50, cultivo_min=60, pendiente_max=12, arables_min=5, ndvi_verano_max=0.55)


def _guardar(df: pd.DataFrame, nombre: str, pk: list[str]) -> None:
    df = df.sort_values(pk).reset_index(drop=True)
    if df.duplicated(pk).any():
        raise ValueError(f"{nombre}: clave primaria {pk} duplicada")
    f = CSV / f"{nombre}.csv"
    df.to_csv(f, index=False, lineterminator="\n", encoding="utf-8")
    print(f"  {nombre}.csv: {len(df):,} filas, {f.stat().st_size / 1e6:.1f} MB")


def construir(provs: list[int]) -> None:
    CSV.mkdir(parents=True, exist_ok=True)
    rec, fincas = cargar_esqueleto(provs)

    # ---- claves ----------------------------------------------------------------------
    fincas["finca_key"] = fincas["provincia"].astype("int64") * 10**8 + fincas.groupby("provincia").cumcount() + 1
    rec["recinto_key"] = rec["provincia"].astype("int64") * 10**8 + rec.groupby("provincia").cumcount() + 1
    rec = rec.merge(fincas[["finca_idx", "finca_key"]], on="finca_idx")
    fincas["municipio_key"] = fincas["provincia"].astype(int) * 1000 + fincas["municipio"]
    fincas["celda_power"] = celda(fincas["lat"], fincas["lon"])["celda_power"]

    print("Dimensiones")
    munis = pd.concat(
        pd.DataFrame(json.loads((COD / f"municipio{p}.json").read_text(encoding="utf-8"))["codigos"]).assign(provincia=p)
        for p in provs
    ).rename(columns={"codigo": "municipio", "descripcion": "nombre"})
    munis["municipio_key"] = munis["provincia"] * 1000 + munis["municipio"]
    _guardar(munis[["municipio_key", "provincia", "municipio", "nombre"]], "dim_municipio", ["municipio_key"])
    celdas = pd.read_parquet(POWER / "celdas.parquet")
    _guardar(celdas, "dim_celda_power", ["celda_power"])

    # ---- Planetary Computer: relieve, cobertura y fenología ------------------------------
    pc = pd.read_parquet(PC / "fincas_pc.parquet")
    feno = pd.read_parquet(PC / "fenologia.parquet")
    fincas = fincas.merge(pc, on="finca_idx", how="left")
    wc_cols = [f"wc_{c}_pct" for c in WC]
    fincas["cobertura_dominante"] = fincas[wc_cols].idxmax(axis=1).str.removeprefix("wc_").str.removesuffix("_pct")
    fincas.loc[fincas[wc_cols].isna().all(axis=1), "cobertura_dominante"] = None

    clases = feno.pivot(index="finca_idx", columns="campana", values="clase_estimada")
    campanas = list(clases.columns)
    resumen = pd.DataFrame(index=clases.index)
    resumen["rotacion_estimada"] = clases.apply(lambda r: "-".join(LETRA[c] for c in r), axis=1)
    resumen["n_campanas_invierno"] = (clases == "herbaceo_invierno").sum(axis=1)
    resumen["n_campanas_verano"] = (clases == "herbaceo_verano").sum(axis=1)
    resumen["n_campanas_barbecho"] = (clases == "barbecho_o_pastizal").sum(axis=1)
    resumen["n_campanas_arables"] = resumen[["n_campanas_invierno", "n_campanas_verano", "n_campanas_barbecho"]].sum(axis=1)
    resumen["ndvi_jun_ago_max"] = feno.groupby("finca_idx")["ndvi_jun_ago"].max()
    fincas = fincas.merge(resumen, left_on="finca_idx", right_index=True, how="left")
    k = CANDIDATA
    fincas["es_candidata"] = (
        (fincas["superficie_ha"] >= k["sup_min"])
        & (fincas["wc_cultivo_pct"] >= k["cultivo_min"])
        & (fincas["pendiente_pct"] <= k["pendiente_max"])
        & (fincas["n_campanas_arables"] >= k["arables_min"])
        & (fincas["n_campanas_invierno"] >= 1)
        & (fincas["ndvi_jun_ago_max"] < k["ndvi_verano_max"])  # sin señal de regadío estival
    ).astype(int)

    print("Hechos")
    cols = (["finca_key", "parcela_id", "municipio_key", "agregado", "zona", "poligono", "parcela", "n_recintos",
             "superficie_ha", "lon", "lat", "celda_power", "n_pixeles", "altitud_m", "pendiente_pct"] + wc_cols
            + ["cobertura_dominante", "rotacion_estimada", "n_campanas_invierno", "n_campanas_verano",
               "n_campanas_barbecho", "n_campanas_arables", "ndvi_jun_ago_max", "es_candidata"])
    _guardar(fincas[cols].astype({c: "Int64" for c in ["n_campanas_invierno", "n_campanas_verano",
                                                       "n_campanas_barbecho", "n_campanas_arables"]}),
             "fincas", ["finca_key"])
    _guardar(rec[["recinto_key", "recinto_id", "finca_key", "recinto", "superficie_ha", "lon", "lat"]],
             "recintos", ["recinto_key"])

    idx2key = fincas.set_index("finca_idx")["finca_key"]
    con_feno = fincas.loc[fincas["superficie_ha"] >= FENO_MIN_HA, "finca_idx"]
    f2 = feno[feno["finca_idx"].isin(con_feno)].copy()
    f2.insert(0, "finca_key", f2.pop("finca_idx").map(idx2key))
    _guardar(f2, "fenologia_fincas", ["finca_key", "campana"])

    ndvi = np.load(PC / "ndvi_fincas.npy")
    fechas = pd.read_parquet(PC / "ndvi_fechas.parquet")["fecha"].dt.strftime("%Y-%m-%d").to_numpy()
    sel = fincas[(fincas["superficie_ha"] >= SERIE_MIN_HA) & (fincas["wc_cultivo_pct"] >= SERIE_MIN_CULTIVO)]
    sub = ndvi[sel["finca_idx"].to_numpy() - 1]
    serie = pd.DataFrame({
        "finca_key": np.repeat(sel["finca_key"].to_numpy(), len(fechas)),
        "fecha": np.tile(fechas, len(sel)),
        "ndvi": np.round(sub.ravel(), 3),
    }).dropna(subset=["ndvi"])
    _guardar(serie, "ndvi_fincas", ["finca_key", "fecha"])

    # ---- Suelo SoilGrids (excepción pedida por el equipo) ---------------------------------
    sg = PROCESSED / "soilgrids" / "suelo_fincas.parquet"
    if sg.exists():
        suelo = pd.read_parquet(sg).dropna(subset=["arcilla_pct"])
        suelo.insert(0, "finca_key", suelo.pop("finca_idx").map(idx2key))
        _guardar(suelo, "suelo_fincas", ["finca_key"])
    else:
        print("  (sin suelo SoilGrids: ejecuta python -m pipeline.soilgrids)")

    # ---- Precios Eurostat (excepción pedida por el equipo) --------------------------------
    pp = PROCESSED / "precios"
    if (pp / "precios_anuales.parquet").exists():
        _guardar(pd.read_parquet(pp / "dim_producto_precio.parquet"), "dim_producto_precio", ["producto_codigo"])
        _guardar(pd.read_parquet(pp / "precios_anuales.parquet"), "precios_anuales", ["producto_codigo", "anio"])
    else:
        print("  (sin precios: ejecuta python -m pipeline.precios)")

    # ---- NASA POWER: clima y humedad del suelo -------------------------------------------
    anual = pd.read_parquet(POWER / "clima_anual.parquet")
    _guardar(anual.drop(columns=SUELO_COLS), "clima_anual", ["celda_power", "campana"])
    _guardar(anual[["celda_power", "campana"] + SUELO_COLS], "suelo_humedad_anual", ["celda_power", "campana"])

    # ---- Polígonos de las candidatas (esqueleto SIGPAC) para el mapa de la app ----------
    GEO.mkdir(parents=True, exist_ok=True)
    cand = fincas[fincas["es_candidata"] == 1]
    partes = []
    for p in provs:
        r = rec[(rec["_prov"] == p) & rec["finca_key"].isin(cand["finca_key"])]
        if r.empty:
            continue
        g = pyogrio.read_dataframe(gpkg_de(p), layer="recinto", columns=[], use_arrow=True)
        g = g.iloc[r["fid"].to_numpy()].assign(finca_key=r["finca_key"].to_numpy())
        partes.append(g.dissolve("finca_key").reset_index())
    if partes:
        geo = pd.concat(partes).merge(cand[["finca_key"] + GEO_COLS], on="finca_key").to_crs(4326)
        dest = GEO / "fincas_candidatas.geojson"
        dest.unlink(missing_ok=True)
        pyogrio.write_dataframe(geo, dest, driver="GeoJSON", COORDINATE_PRECISION=6)
        print(f"  {dest.relative_to(PROCESSED)}: {len(geo)} fincas")

    n = fincas["es_candidata"].sum()
    na = fincas.loc[fincas["municipio_key"] == 29015, "es_candidata"].sum() if 29 in provs else 0
    print(f"Candidatas: {n} en total, {na} en Antequera. Campañas NDVI: {campanas}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--provincias", default="29")
    construir([int(p) for p in ap.parse_args().provincias.split(",")])


if __name__ == "__main__":
    main()
