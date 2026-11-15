"""Build the star model and export CSVs ready to load into a database.

All thematic content comes from sources in resources.md:
    POWER                 climate and soil moisture (pipeline.power)
    Planetary Computer    SRTM-derived DEM, ESA WorldCover, MODIS NDVI (pipeline.pc)
SIGPAC only provides the skeleton: identifier, municipality and geometry of each farm.

Output: data/<scope>/csv/comun/*.csv (common tables) and data/<scope>/csv/<pp_provincia>/*.csv
(one folder per province), UTF-8, comma, decimal point, NULL = empty, sorted
by primary key. Copies pipeline/sql/*.sql to data/<scope>/database/.

Keys:
    finca_key     = province * 10^8 + order by SIGPAC code (plot)
    recinto_key   = province * 10^8 + order by SIGPAC code
    municipio_key = province * 1000 + municipality
    celda_power   = index of the MERRA-2 cell (see pipeline.power.celda)
The integer keys are for fast JOINs within one version of the data; the
identifier that is stable across versions is the SIGPAC code (`parcela_id`, `recinto_id`).

Usage:
    python -m pipeline.build --ambito andalucia      # provinces of AMBITOS["andalucia"]
    python -m pipeline.subconjunto --de andalucia --a malaga
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import unicodedata
from pathlib import Path

import numpy as np
import pandas as pd
import pyogrio

from pipeline.common import AMBITOS, DATA, PROCESSED, RAW, SQL_DIR
from pipeline.power import celda
from pipeline.sigpac import cargar_esqueleto, gpkg_de

CSV = DATA / "andalucia" / "csv"  # set in construir() according to the scope
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
# Farms with phenology (MODIS 250 m ≈ 6 ha: below 2 ha the pixel is almost all neighbour)
FENO_MIN_HA = 2.0
# Full NDVI series only for large agricultural farms (for the app charts)
SERIE_MIN_HA, SERIE_MIN_CULTIVO = 10.0, 50.0
# Candidate for the "case farm" (rainfed farmland of the campiña). The plan talks about a holding of
# 150–250 ha in 5–20 plots, but without the declared crop from SIGPAC (outside
# resources.md) plots cannot be grouped into holdings: large arable plots are
# searched for. Arable classes: I (winter), V (summer), B (fallow/weak crop).
CANDIDATA = dict(sup_min=50, cultivo_min=60, pendiente_max=12, arables_min=5, ndvi_verano_max=0.55)


NOMBRE_PROV: dict[int, str] = {}  # filled in construir() with the SIGPAC codes


def carpeta_provincia(p: int) -> Path:
    """data/csv/29_malaga, data/csv/04_almeria…"""
    nombre = unicodedata.normalize("NFKD", NOMBRE_PROV.get(p, str(p))).encode("ascii", "ignore").decode()
    return CSV / f"{p:02d}_{re.sub(r'[^a-z0-9]+', '_', nombre.lower()).strip('_')}"


def por_finca(df: pd.DataFrame) -> pd.Series:
    return df["finca_key"] // 10**8


def _guardar(df: pd.DataFrame, nombre: str, pk: list[str], provincia=None) -> None:
    """Write the table to data/csv/comun/ or, with `provincia`, one CSV per province.

    `provincia` is the name of a column or a function that computes it.
    """
    df = df.sort_values(pk).reset_index(drop=True)
    if df.duplicated(pk).any():
        raise ValueError(f"{nombre}: clave primaria {pk} duplicada")
    if provincia is None:
        partes = [(CSV / "comun", df)]
    else:
        p = provincia(df) if callable(provincia) else df[provincia]
        partes = [(carpeta_provincia(int(k)), g) for k, g in df.groupby(p.to_numpy(), sort=True)]
    total = 0
    for carpeta, g in partes:
        carpeta.mkdir(parents=True, exist_ok=True)
        f = carpeta / f"{nombre}.csv"
        g.to_csv(f, index=False, lineterminator="\n", encoding="utf-8")
        total += f.stat().st_size
    donde = "comun/" if provincia is None else f"{len(partes)} provincias"
    print(f"  {nombre}.csv ({donde}): {len(df):,} rows, {total / 1e6:.1f} MB")


def construir(provs: list[int], ambito: str) -> None:
    global CSV
    CSV = DATA / ambito / "csv"
    CSV.mkdir(parents=True, exist_ok=True)
    for viejo in list(CSV.glob("*.csv")) + list(CSV.glob("*/*.csv")):
        viejo.unlink()  # generated output: rewritten entirely on each build
    NOMBRE_PROV.update({c["codigo"]: c["descripcion"]
                        for c in json.loads((COD / "provincia.json").read_text(encoding="utf-8"))["codigos"]})
    rec, fincas = cargar_esqueleto(provs)

    # ---- keys ----------------------------------------------------------------------
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
    _guardar(munis[["municipio_key", "provincia", "municipio", "nombre"]], "dim_municipio", ["municipio_key"],
             provincia="provincia")
    celdas = pd.read_parquet(POWER / "celdas.parquet")
    _guardar(celdas, "dim_celda_power", ["celda_power"])

    # ---- Planetary Computer: relief, cover and phenology ------------------------------
    pc = pd.read_parquet(PC / "fincas_pc.parquet")
    feno = pd.read_parquet(PC / "fenologia.parquet")
    # The intermediates use finca_idx, which depends on the list of provinces: if they come from
    # another run, the joins would go wrong without warning.
    if len(pc) != len(fincas) or not pc["finca_idx"].isin(fincas["finca_idx"]).all():
        raise RuntimeError(
            f"The pipeline.pc intermediates are from a different set of provinces ({len(pc):,} farms, "
            f"{len(fincas):,} expected). Run pc and soilgrids with the same --provincias, "
            "or use pipeline.subconjunto to extract a copy from one that is already built.")
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
        & (fincas["ndvi_jun_ago_max"] < k["ndvi_verano_max"])  # no summer irrigation signal
    ).astype(int)

    print("Hechos")
    cols = (["finca_key", "provincia", "parcela_id", "municipio_key", "agregado", "zona", "poligono", "parcela", "n_recintos",
             "superficie_ha", "lon", "lat", "celda_power", "n_pixeles", "altitud_m", "pendiente_pct"] + wc_cols
            + ["cobertura_dominante", "rotacion_estimada", "n_campanas_invierno", "n_campanas_verano",
               "n_campanas_barbecho", "n_campanas_arables", "ndvi_jun_ago_max", "es_candidata"])
    _guardar(fincas[cols].astype({c: "Int64" for c in ["n_campanas_invierno", "n_campanas_verano",
                                                       "n_campanas_barbecho", "n_campanas_arables"]}),
             "fincas", ["finca_key"], provincia="provincia")
    _guardar(rec[["recinto_key", "recinto_id", "finca_key", "recinto", "superficie_ha", "lon", "lat"]],
             "recintos", ["recinto_key"], provincia=por_finca)

    idx2key = fincas.set_index("finca_idx")["finca_key"]
    con_feno = fincas.loc[fincas["superficie_ha"] >= FENO_MIN_HA, "finca_idx"]
    f2 = feno[feno["finca_idx"].isin(con_feno)].copy()
    f2.insert(0, "finca_key", f2.pop("finca_idx").map(idx2key))
    _guardar(f2, "fenologia_fincas", ["finca_key", "campana"], provincia=por_finca)

    ndvi = np.load(PC / "ndvi_fincas.npy")
    fechas = pd.read_parquet(PC / "ndvi_fechas.parquet")["fecha"].dt.strftime("%Y-%m-%d").to_numpy()
    sel = fincas[(fincas["superficie_ha"] >= SERIE_MIN_HA) & (fincas["wc_cultivo_pct"] >= SERIE_MIN_CULTIVO)]
    sub = ndvi[sel["finca_idx"].to_numpy() - 1]
    serie = pd.DataFrame({
        "finca_key": np.repeat(sel["finca_key"].to_numpy(), len(fechas)),
        "fecha": np.tile(fechas, len(sel)),
        "ndvi": np.round(sub.ravel(), 3),
    }).dropna(subset=["ndvi"])
    _guardar(serie, "ndvi_fincas", ["finca_key", "fecha"], provincia=por_finca)

    # ---- SoilGrids soil (exception requested by the team) ---------------------------------
    sg = PROCESSED / "soilgrids" / "suelo_fincas.parquet"
    if sg.exists():
        suelo = pd.read_parquet(sg).dropna(subset=["arcilla_pct"])
        suelo.insert(0, "finca_key", suelo.pop("finca_idx").map(idx2key))
        _guardar(suelo, "suelo_fincas", ["finca_key"], provincia=por_finca)
    else:
        print("  (no SoilGrids soil: run python -m pipeline.soilgrids)")

    # ---- Eurostat prices (exception requested by the team) --------------------------------
    pp = PROCESSED / "precios"
    if (pp / "precios_anuales.parquet").exists():
        _guardar(pd.read_parquet(pp / "dim_producto_precio.parquet"), "dim_producto_precio", ["producto_codigo"])
        _guardar(pd.read_parquet(pp / "precios_anuales.parquet"), "precios_anuales", ["producto_codigo", "anio"])
    else:
        print("  (no prices: run python -m pipeline.precios)")

    # ---- Hand-transcribed series (e.g. MAPA vetch): data/manual/*.csv --------------
    for f in sorted((DATA / "manual").glob("*.csv")):
        (CSV / "comun").mkdir(parents=True, exist_ok=True)
        shutil.copy2(f, CSV / "comun" / f.name)
        print(f"  {f.name} (comun/): copied from data/manual/")

    # ---- POWER: climate and soil moisture -------------------------------------------
    anual = pd.read_parquet(POWER / "clima_anual.parquet")
    _guardar(anual.drop(columns=SUELO_COLS), "clima_anual", ["celda_power", "campana"])
    _guardar(anual[["celda_power", "campana"] + SUELO_COLS], "suelo_humedad_anual", ["celda_power", "campana"])

    # ---- Polygons of the candidates (SIGPAC skeleton) for the app map ----------
    GEO.mkdir(parents=True, exist_ok=True)
    cand = fincas[fincas["es_candidata"] == 1]
    partes = []
    for p in provs:
        r = rec[(rec["_prov"] == p) & rec["finca_key"].isin(cand["finca_key"])]
        if r.empty:
            continue
        try:
            gpkg = gpkg_de(p)
        except FileNotFoundError:
            print(f"  (no GeoPackage for province {p}: its candidates are left out of the GeoJSON)")
            continue
        g = pyogrio.read_dataframe(gpkg, layer="recinto", columns=[], use_arrow=True)
        g = g.iloc[r["fid"].to_numpy()].assign(finca_key=r["finca_key"].to_numpy())
        partes.append(g.dissolve("finca_key").reset_index())
    if partes:
        geo = pd.concat(partes).merge(cand[["finca_key"] + GEO_COLS], on="finca_key").to_crs(4326)
        dest = GEO / "fincas_candidatas.geojson"
        dest.unlink(missing_ok=True)
        pyogrio.write_dataframe(geo, dest, driver="GeoJSON", COORDINATE_PRECISION=6)
        print(f"  {dest.relative_to(PROCESSED)}: {len(geo)} farms")

    n = fincas["es_candidata"].sum()
    na = fincas.loc[fincas["municipio_key"] == 29015, "es_candidata"].sum() if 29 in provs else 0
    print(f"Candidatas: {n} in total, {na} in Antequera. NDVI seasons: {campanas}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ambito", default="andalucia", help=f"Copy to build: {', '.join(AMBITOS)} or another name")
    ap.add_argument("--provincias", default=None, help="Comma-separated codes (by default, those of the scope)")
    a = ap.parse_args()
    provs = [int(p) for p in a.provincias.split(",")] if a.provincias else AMBITOS[a.ambito]
    construir(provs, a.ambito)
    destino = DATA / a.ambito / "database"
    destino.mkdir(parents=True, exist_ok=True)
    for sql in SQL_DIR.glob("*.sql"):
        shutil.copy2(sql, destino / sql.name)
    print(f"-> data/{a.ambito}/csv/ y data/{a.ambito}/database/*.sql")


if __name__ == "__main__":
    main()
