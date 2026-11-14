"""Polígonos de las fincas de una provincia para el mapa de la app (app/public/data/).

Une los recintos SIGPAC de cada finca (parcela) en un polígono, lo simplifica un poco
para que el navegador lo cargue rápido y le añade los atributos de
data/<copia>/csv/<pp_provincia>/fincas.csv (las dos copias tienen las mismas filas).
Escribe un GeoJSON comprimido por municipio (la app solo descarga el municipio que se
abre) y un GeoJSON con el contorno de cada municipio para la vista de provincia.
Cada finca lleva `apt`: por qué no parece campo de cultivo (ver aptitud()), o null.
Necesita el GeoPackage de recintos extraído por pipeline.sigpac.

Uso:
    python -m pipeline.export_app_fincas                 # Málaga (29)
    python -m pipeline.export_app_fincas --provincia 29

Salida:
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
TOLERANCIA_M = 1.5  # simplificación de fincas en metros
CIERRE_M = 15  # cierra los huecos de caminos entre fincas al dibujar el municipio
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
PENDIENTE_FUERTE = 30  # % de pendiente: por encima, el laboreo y la maquinaria son muy difíciles
PARCELA_DOMINIO_PUBLICO = 9000  # en catastro y SIGPAC, las parcelas 9000+ son caminos, carreteras y cauces


def aptitud(f: pd.Series) -> str | None:
    """Por qué una finca no parece campo de cultivo (None = parece apta).

    Reglas sobre la cobertura ESA WorldCover (% de la finca), la pendiente NASADEM y el número de
    parcela: urbano, agua y dominio público (parcelas 9000+) no son agrícolas; roca, monte y
    pendiente fuerte son de uso limitado.
    El arbolado en pendiente suave no se marca: en Málaga suele ser olivar o almendral.
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
    return round(c, 5) if isinstance(c, float) else [_redondear(x) for x in c]  # 5 decimales ≈ 1 m


def _csv_provincia(prov: int) -> Path:
    carpetas = sorted(DATA.glob(f"*/csv/{prov:02d}_*/"))
    if not carpetas:
        raise SystemExit(f"No hay CSV de la provincia {prov} en data/*/csv/")
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
    rec["geometry"] = rec.geometry.make_valid()  # algunos recintos SIGPAC traen anillos inválidos
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

    print(f"{len(geo):,} de {len(fincas):,} fincas en {geo['mun'].nunique()} municipios -> "
          f"{carpeta.relative_to(ROOT)}/ ({total / 1e6:.1f} MB comprimido)")
    print(f"Municipios -> {municipios.relative_to(ROOT)} ({municipios.stat().st_size / 1e6:.1f} MB)")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--provincia", type=int, default=29)
    exportar(ap.parse_args().provincia)


if __name__ == "__main__":
    main()
