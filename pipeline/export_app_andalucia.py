"""Andalucía landing page and municipality colours of Málaga for the app.

The app opens on Andalucía (8 provinces) and descends to Málaga through clouds. This script
writes what those two levels need:

- the provinces of Spain (those of Andalucía with their farm figures taken from
  data/andalucia/csv/*/fincas.csv; the rest, only as dark context);
- for each municipality of the province, the share of its farms that is cropland
  (ESA WorldCover) and the mean rain and water deficit of its POWER cell.

The boundaries are drawn with es-atlas (IGN, CC BY 4.0), because the CSVs carry no
administrative geometry.

Usage:
    python -m pipeline.export_app_andalucia
    python -m pipeline.export_app_andalucia --provincia 29

Output:
    app/public/data/provincias_andalucia.geojson
    app/public/data/municipios_{provincia}_stats.json
"""

from __future__ import annotations

import argparse
import json
import math

import pandas as pd

from pipeline.common import RAW, ROOT, download

ES_ATLAS = "https://cdn.jsdelivr.net/npm/es-atlas@0.6.0/es/provinces.json"
ANDALUCIA = {"04": "Almería", "11": "Cádiz", "14": "Córdoba", "18": "Granada",
             "21": "Huelva", "23": "Jaén", "29": "Málaga", "41": "Sevilla"}
CARPETAS = {"04": "04_almeria", "11": "11_cadiz", "14": "14_cordoba", "18": "18_granada",
            "21": "21_huelva", "23": "23_jaen", "29": "29_malaga", "41": "41_sevilla"}
SALIDA = ROOT / "app" / "public" / "data"


def _arcos(topo: dict) -> list[list[tuple[float, float]]]:
    """Decode the quantised arcs of a TopoJSON."""
    tf = topo["transform"]
    arcos = []
    for arco in topo["arcs"]:
        x = y = 0
        puntos = []
        for dx, dy in arco:
            x += dx
            y += dy
            puntos.append((x * tf["scale"][0] + tf["translate"][0], y * tf["scale"][1] + tf["translate"][1]))
        arcos.append(puntos)
    return arcos


def _anillo(arcos, indices) -> list[tuple[float, float]]:
    out: list[tuple[float, float]] = []
    for i in indices:
        tramo = arcos[i] if i >= 0 else arcos[~i][::-1]
        out.extend(tramo if not out else tramo[1:])
    return out


def _simplifica(puntos, tol: float):
    """Douglas-Peucker in degrees."""
    if len(puntos) < 5:
        return puntos
    keep = [False] * len(puntos)
    keep[0] = keep[-1] = True
    pila = [(0, len(puntos) - 1)]
    while pila:
        a, b = pila.pop()
        (ax, ay), (bx, by) = puntos[a], puntos[b]
        dx, dy = bx - ax, by - ay
        norma = math.hypot(dx, dy) or 1e-12
        mejor, idx = -1.0, -1
        for i in range(a + 1, b):
            px, py = puntos[i]
            d = abs(dy * px - dx * py + bx * ay - by * ax) / norma
            if d > mejor:
                mejor, idx = d, i
        if mejor > tol and idx > 0:
            keep[idx] = True
            pila += [(a, idx), (idx, b)]
    out = [p for p, k in zip(puntos, keep) if k]
    return out if len(out) >= 4 else puntos


def _geometria(g: dict, arcos, tol: float, nd: int) -> dict:
    poligonos = [g["arcs"]] if g["type"] == "Polygon" else g["arcs"]
    coords = [[[[round(x, nd), round(y, nd)] for x, y in _simplifica(_anillo(arcos, r), tol)] for r in p] for p in poligonos]
    if g["type"] == "Polygon":
        return {"type": "Polygon", "coordinates": coords[0]}
    return {"type": "MultiPolygon", "coordinates": coords}


def _cifras_provincia(codigo: str) -> dict:
    df = pd.read_csv(
        ROOT / "data" / "andalucia" / "csv" / CARPETAS[codigo] / "fincas.csv",
        usecols=["superficie_ha", "cobertura_dominante", "es_candidata"],
    )
    return {
        "fincas": int(len(df)),
        "ha": int(round(df["superficie_ha"].sum())),
        "pct_cultivo": round(100 * float((df["cobertura_dominante"] == "cultivo").mean()), 1),
        "candidatas": int(df["es_candidata"].sum()),
    }


def provincias() -> dict:
    destino = RAW / "es_atlas" / "provinces.json"
    download(ES_ATLAS, destino, "es-atlas 0.6.0 (IGN, CC BY 4.0)")
    topo = json.loads(destino.read_text(encoding="utf-8"))
    arcos = _arcos(topo)
    features = []
    for g in topo["objects"]["provinces"]["geometries"]:
        pid = str(g["id"]).zfill(2)
        andaluza = pid in ANDALUCIA
        props = {"id": pid, "nombre": ANDALUCIA.get(pid, g.get("properties", {}).get("name", pid)), "and": int(andaluza)}
        if andaluza:
            props.update(_cifras_provincia(pid))
            print(f"  {props['nombre']}: {props['fincas']} farms")
        features.append({
            "type": "Feature",
            "properties": props,
            "geometry": _geometria(g, arcos, 0.004 if andaluza else 0.012, 4 if andaluza else 3),
        })
    return {"type": "FeatureCollection", "features": features}


def municipios(provincia: int) -> dict:
    csv = ROOT / "data" / "andalucia" / "csv" / CARPETAS[f"{provincia:02d}"]
    fincas = pd.read_csv(csv / "fincas.csv", usecols=["municipio_key", "celda_power", "cobertura_dominante"])
    celdas = pd.read_csv(ROOT / "data" / "andalucia" / "csv" / "comun" / "dim_celda_power.csv",
                         usecols=["celda_power", "lluvia_media_mm", "deficit_medio_mm"])
    df = fincas.merge(celdas, on="celda_power", how="left")
    df["cultivo"] = df["cobertura_dominante"] == "cultivo"
    resumen = df.groupby("municipio_key").agg(
        pct_cultivo=("cultivo", "mean"), lluvia_mm=("lluvia_media_mm", "mean"), deficit_mm=("deficit_medio_mm", "mean")
    )
    return {
        str(mun): {
            "pct_cultivo": round(100 * float(r.pct_cultivo), 1),
            "lluvia_mm": None if pd.isna(r.lluvia_mm) else int(round(r.lluvia_mm)),
            "deficit_mm": None if pd.isna(r.deficit_mm) else int(round(r.deficit_mm)),
        }
        for mun, r in resumen.iterrows()
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--provincia", type=int, default=29)
    args = parser.parse_args()

    geo = provincias()
    ruta = SALIDA / "provincias_andalucia.geojson"
    ruta.write_text(json.dumps(geo, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{ruta.relative_to(ROOT)}: {ruta.stat().st_size / 1e3:.0f} kB")

    stats = municipios(args.provincia)
    ruta = SALIDA / f"municipios_{args.provincia}_stats.json"
    ruta.write_text(json.dumps(stats, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{ruta.relative_to(ROOT)}: {len(stats)} municipalities")


if __name__ == "__main__":
    main()
