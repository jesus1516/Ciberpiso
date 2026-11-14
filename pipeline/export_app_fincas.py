"""Farm polygons of a province for the app map (app/public/data/).

Merges the SIGPAC enclosures of each farm (plot) into one polygon, simplifies it a bit
so the browser loads it fast and adds the attributes of
data/<copy>/csv/<pp_provincia>/fincas.csv (both copies have the same rows).
Writes one compressed GeoJSON per municipality (the app only downloads the municipality
that is opened) and a GeoJSON with the outline of each municipality for the province view.
Each farm carries `apt`: why it does not look like cropland (see aptitud()), or null.
Needs the enclosures GeoPackage extracted by pipeline.sigpac.

Usage:
    python -m pipeline.export_app_fincas                 # Málaga (29)
    python -m pipeline.export_app_fincas --provincia 29

Output:
    app/public/data/fincas/{municipio_key}.geojson.gz
    app/public/data/municipios_{provincia}.geojson
"""

from __future__ import annotations

import argparse
import gzip
import json
from pathlib import Path

import geopandas as gpd
import pandas as pd
import pyogrio

from pipeline.common import DATA, ROOT
from pipeline.sigpac import NAT, gpkg_de

UTM = 25830
TOLERANCIA_M = 1.5  # farm simplification in metres
CIERRE_M = 15  # closes the gaps of tracks between farms when drawing the municipality
TOLERANCIA_MUNICIPIO_M = 20
SALIDA = ROOT / "app" / "public" / "data"
PROPS = {
    "finca_key": "id",
    "parcela_id": "pid",
    "municipio_key": "mun",
    "poligono": "pol",
    "parcela": "par",
    "superficie_ha": "ha",
    "pendiente_pct": "slope",
    "altitud_m": "alt",
    "cobertura_dominante": "cover",
    "rotacion_estimada": "rot",
    "es_candidata": "cand",
}
WC = ["wc_urbano_pct", "wc_agua_pct", "wc_suelo_desnudo_pct", "wc_matorral_pct", "wc_arbolado_pct"]
PENDIENTE_FUERTE = 30  # % slope: above it, tillage and machinery are very difficult
PARCELA_DOMINIO_PUBLICO = 9000  # in the cadastre and SIGPAC, plots 9000+ are tracks, roads and watercourses


def aptitud(f: pd.Series) -> str | None:
    """Why a farm does not look like cropland (None = looks suitable).

    Rules on ESA WorldCover cover (% of the farm), NASADEM slope and the plot
    number: built-up, water and public land (plots 9000+) are not agricultural; rock, mountain and
    steep slope are of limited use.
    Trees on gentle slopes are not marked: in Málaga they are usually olive or almond groves.
    """
    if pd.isna(f["wc_urbano_pct"]):
        return None
    dominante = f["cobertura_dominante"]
    if f["wc_urbano_pct"] >= 50 or (dominante == "urbano" and f["wc_urbano_pct"] >= 30):
        return "urbano"
    if f["wc_agua_pct"] >= 50 or dominante == "agua":
        return "agua"
    if f["parcela"] >= PARCELA_DOMINIO_PUBLICO:
        return "publico"
    if f["wc_suelo_desnudo_pct"] >= 50:
        return "roca"
    pendiente = 0 if pd.isna(f["pendiente_pct"]) else f["pendiente_pct"]
    natural = f["wc_matorral_pct"] + f["wc_arbolado_pct"]
    if f["wc_matorral_pct"] >= 50 or (natural >= 80 and pendiente >= PENDIENTE_FUERTE):
        return "monte"
    if pendiente >= PENDIENTE_FUERTE:
        return "pendiente"
    return None


def _geojson(gdf: gpd.GeoDataFrame) -> bytes:
    data = json.loads(gdf.to_crs(4326).to_json(drop_id=True, to_wgs84=False))
    for f in data["features"]:
        f["geometry"]["coordinates"] = _redondear(f["geometry"]["coordinates"])
    data.pop("crs", None)
    return json.dumps(data, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def _redondear(c):
    return round(c, 5) if isinstance(c, float) else [_redondear(x) for x in c]  # 5 decimals ≈ 1 m


def _csv_provincia(prov: int) -> Path:
    carpetas = sorted(DATA.glob(f"*/csv/{prov:02d}_*/"))
    if not carpetas:
        raise SystemExit(f"No CSV for province {prov} in data/*/csv/")
    return carpetas[0]


def exportar(prov: int) -> None:
    csv = _csv_provincia(prov)
    fincas = pd.read_csv(csv / "fincas.csv", usecols=list(PROPS) + WC)
    fincas = fincas[fincas["municipio_key"] // 1000 == prov]
    fincas["apt"] = fincas.apply(aptitud, axis=1)
    fincas = fincas.drop(columns=WC)
    nombres = pd.read_csv(csv / "dim_municipio.csv").set_index("municipio_key")["nombre"]

    rec = pyogrio.read_dataframe(gpkg_de(prov), layer="recinto", columns=NAT, where=f"provincia = {prov}", use_arrow=True)
    parts = [rec[k].astype("int64").astype(str) for k in NAT]
    rec["parcela_id"] = parts[0].str.cat(parts[1:], sep=":")
    rec = rec[["parcela_id", "geometry"]].to_crs(UTM)
    rec["geometry"] = rec.geometry.make_valid()  # some SIGPAC enclosures bring invalid rings
    geo = rec.dissolve("parcela_id").reset_index()
    geo["geometry"] = geo.geometry.simplify(TOLERANCIA_M, preserve_topology=True)
    geo = geo.merge(fincas, on="parcela_id").rename(columns=PROPS)
    geo["ha"] = geo["ha"].round(2)

    carpeta = SALIDA / "fincas"
    carpeta.mkdir(parents=True, exist_ok=True)
    for old in carpeta.glob(f"{prov:02d}*.geojson.gz"):
        old.unlink()
    total = 0
    for mun, g in geo.groupby("mun"):
        destino = carpeta / f"{mun}.geojson.gz"
        destino.write_bytes(gzip.compress(_geojson(g), compresslevel=9, mtime=0))
        total += destino.stat().st_size

    muni = geo.assign(geometry=geo.geometry.buffer(CIERRE_M)).dissolve(
        "mun", aggfunc={"id": "count", "ha": "sum", "cand": "sum"}
    )
    muni["geometry"] = muni.geometry.buffer(-CIERRE_M).simplify(TOLERANCIA_MUNICIPIO_M, preserve_topology=True)
    muni = muni.reset_index().rename(columns={"id": "fincas", "cand": "candidatas"})
    muni["ha"] = muni["ha"].round(0)
    muni["nombre"] = muni["mun"].map(nombres)
    municipios = SALIDA / f"municipios_{prov:02d}.geojson"
    municipios.write_bytes(_geojson(muni[["mun", "nombre", "fincas", "ha", "candidatas", "geometry"]]))

    print(f"{len(geo):,} of {len(fincas):,} farms in {geo['mun'].nunique()} municipalities -> "
          f"{carpeta.relative_to(ROOT)}/ ({total / 1e6:.1f} MB compressed)")
    print(f"Municipios -> {municipios.relative_to(ROOT)} ({municipios.stat().st_size / 1e6:.1f} MB)")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--provincia", type=int, default=29)
    exportar(ap.parse_args().provincia)


if __name__ == "__main__":
    main()
