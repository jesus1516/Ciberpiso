"""Polígonos de las fincas de un municipio para el mapa de la app (app/public/data/).

Une los recintos SIGPAC de cada finca (parcela) en un polígono, lo simplifica un poco
para que el navegador lo cargue rápido y le añade los atributos de data/csv/fincas.csv.
Necesita el GeoPackage de recintos extraído por pipeline.sigpac.

Uso:
    python -m pipeline.export_app_fincas                     # Antequera (29015)
    python -m pipeline.export_app_fincas --municipio 29015 --salida app/public/data/fincas_antequera.geojson
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd
import pyogrio

from pipeline.common import CSV_DIR, ROOT
from pipeline.sigpac import NAT, gpkg_de

TOLERANCIA_M = 1.5  # simplificación en metros (UTM 30N)
PROPS = {
    "finca_key": "id",
    "parcela_id": "pid",
    "poligono": "pol",
    "parcela": "par",
    "superficie_ha": "ha",
    "pendiente_pct": "slope",
    "altitud_m": "alt",
    "cobertura_dominante": "cover",
    "rotacion_estimada": "rot",
    "es_candidata": "cand",
}


def exportar(municipio_key: int, salida: Path) -> None:
    prov, mun = divmod(municipio_key, 1000)
    fincas = pd.read_csv(CSV_DIR / "fincas.csv", usecols=list(PROPS) + ["municipio_key"])
    fincas = fincas[fincas["municipio_key"] == municipio_key].drop(columns="municipio_key")

    rec = pyogrio.read_dataframe(gpkg_de(prov), layer="recinto", columns=NAT,
                                 where=f"provincia = {prov} AND municipio = {mun}", use_arrow=True)
    parts = [rec[k].astype("int64").astype(str) for k in NAT]
    rec["parcela_id"] = parts[0].str.cat(parts[1:], sep=":")
    geo = rec[["parcela_id", "geometry"]].to_crs(25830).dissolve("parcela_id").reset_index()
    geo["geometry"] = geo.geometry.simplify(TOLERANCIA_M, preserve_topology=True)
    geo = geo.to_crs(4326).merge(fincas, on="parcela_id").rename(columns=PROPS)
    geo["ha"] = geo["ha"].round(2)

    salida.parent.mkdir(parents=True, exist_ok=True)
    salida.unlink(missing_ok=True)
    pyogrio.write_dataframe(geo, salida, driver="GeoJSON", COORDINATE_PRECISION=5)  # ~1 m
    datos = json.loads(salida.read_text(encoding="utf-8"))
    datos.pop("crs", None)
    salida.write_text(json.dumps(datos, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(f"{len(geo):,} de {len(fincas):,} fincas -> {salida.relative_to(ROOT)} ({salida.stat().st_size / 1e6:.1f} MB)")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--municipio", type=int, default=29015, help="municipio_key (provincia * 1000 + municipio)")
    ap.add_argument("--salida", type=Path, default=ROOT / "app" / "public" / "data" / "fincas_antequera.geojson")
    a = ap.parse_args()
    exportar(a.municipio, a.salida.resolve())


if __name__ == "__main__":
    main()
