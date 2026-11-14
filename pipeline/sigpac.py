"""Farm skeleton from SIGPAC (FEGA): identifiers and geometry only.

No source in resources.md delimits farms in Spain, so SIGPAC is used
**only** to know where each farm (plot) is and which enclosures make it up.
No thematic SIGPAC attribute is used (use, slope, altitude, irrigation,
declared crop): that data comes from sources in resources.md (pipeline.pc,
pipeline.power).

Source: https://sigpac-hubcloud.es/geopackages/ (CC BY 4.0, author: FEGA).

Usage:
    python -m pipeline.sigpac --provincias 29
    python -m pipeline.sigpac --provincias all --borrar-bruto   # all of Spain

Generates data/processed/sigpac/esqueleto_{prov}.parquet (one record per enclosure) and leaves
the extracted GeoPackage in data/raw/sigpac/extract/ to rasterise the farms.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import zipfile
from pathlib import Path
from urllib.parse import quote

import numpy as np
import pandas as pd
import pyogrio

from pipeline.common import PROCESSED, RAW, download, record, session

BASE = "https://sigpac-hubcloud.es"
YEAR = 2026
RAW_SIGPAC = RAW / "sigpac"
OUT = PROCESSED / "sigpac"
NAT = ["provincia", "municipio", "agregado", "zona", "poligono", "parcela"]
COLS = NAT + ["recinto", "dn_surface"]


def listar() -> dict[int, tuple[str, int]]:
    """Enclosure zip per province: {29: ('29_MALAGA_rec_2026_..zip', bytes)}."""
    html = session().get(f"{BASE}/geopackages/{YEAR}/recintos/", timeout=60).text
    out = {
        int(name[:2]): (name, int(size))
        for size, name in re.findall(r"(\d+) <A HREF=\"[^\"]+\">([^<]+\.zip)</A>", html, flags=re.I)
    }
    if not out:
        raise RuntimeError(f"No files in {YEAR}/recintos")
    return out


def municipios(prov: int) -> list[dict]:
    f = RAW_SIGPAC / "codigos" / f"municipio{prov}.json"
    if not f.exists():
        f.parent.mkdir(parents=True, exist_ok=True)
        url = f"{BASE}/codigossigpac/municipio{prov}.json"
        r = session().get(url, timeout=60)
        r.raise_for_status()
        f.write_bytes(r.content)
        record("FEGA SIGPAC códigos", url, f)
    return json.loads(f.read_text(encoding="utf-8"))["codigos"]


def cargar_esqueleto(provincias: list[int]) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Enclosures and farms (plots) in canonical order, with a farm index 1..N.

    All modules use this order, so `finca_idx` matches across them.
    """
    rec = pd.concat(
        pd.read_parquet(OUT / f"esqueleto_{p:02d}.parquet").assign(_prov=p) for p in provincias
    ).sort_values(NAT + ["recinto"], kind="stable").reset_index(drop=True)
    fincas = rec.drop_duplicates("parcela_id")[["parcela_id"] + NAT].reset_index(drop=True)
    fincas["finca_idx"] = np.arange(1, len(fincas) + 1, dtype="int32")
    rec = rec.merge(fincas[["parcela_id", "finca_idx"]], on="parcela_id", how="left")
    # Area-weighted centroid and total area per farm
    w = rec["superficie_ha"].clip(lower=1e-6)
    agg = (
        rec.assign(_wlon=rec["lon"] * w, _wlat=rec["lat"] * w, _w=w)
        .groupby("finca_idx")
        .agg(_wlon=("_wlon", "sum"), _wlat=("_wlat", "sum"), _w=("_w", "sum"),
             superficie_ha=("superficie_ha", "sum"), n_recintos=("recinto", "size"))
    )
    fincas = fincas.merge(agg, left_on="finca_idx", right_index=True)
    fincas["lon"] = (fincas.pop("_wlon") / fincas["_w"]).round(6)
    fincas["lat"] = (fincas.pop("_wlat") / fincas.pop("_w")).round(6)
    fincas["superficie_ha"] = fincas["superficie_ha"].round(4)
    return rec, fincas


def gpkg_de(prov: int) -> Path:
    gpkgs = list((RAW_SIGPAC / "extract" / f"{prov:02d}_recintos").glob("*.gpkg"))
    if not gpkgs:
        raise FileNotFoundError(f"GeoPackage of province {prov} is missing: run pipeline.sigpac")
    return gpkgs[0]


def _extraer(zip_path: Path, prov: int) -> Path:
    destino = RAW_SIGPAC / "extract" / f"{prov:02d}_recintos"
    if list(destino.glob("*.gpkg")):
        return gpkg_de(prov)
    destino.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as z:
        miembros = [m for m in z.namelist() if m.endswith(".gpkg") and "/" not in m.strip("/")]
        if len(miembros) != 1:
            raise RuntimeError(f"Contenido inesperado en {zip_path.name}: {z.namelist()}")
        z.extract(miembros[0], destino)
    return destino / miembros[0]


def esqueleto(gpkg: Path, prov: int) -> pd.DataFrame:
    gdf = pyogrio.read_dataframe(gpkg, layer="recinto", columns=COLS, use_arrow=True)
    utm = 4083 if prov in (35, 38) else 25830  # Canarias: REGCAN95 / UTM 28N
    c = gdf.geometry.to_crs(utm).centroid.to_crs(4326)
    df = pd.DataFrame(gdf.drop(columns="geometry"))
    parts = [df[k].astype("int64").astype(str) for k in NAT]
    df["parcela_id"] = parts[0].str.cat(parts[1:], sep=":")
    df["recinto_id"] = df["parcela_id"] + ":" + df["recinto"].astype("int64").astype(str)
    df["superficie_ha"] = (df.pop("dn_surface") / 1e4).round(4)  # area of the geometry
    df["lon"], df["lat"] = c.x.round(6).to_numpy(), c.y.round(6).to_numpy()
    df["fid"] = gdf.index.to_numpy()  # position in the GeoPackage, for rasterising
    return df


def run(provincias: list[int], borrar_bruto: bool, borrar_zip: bool = False) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    lista = listar()
    for prov in provincias:
        municipios(prov)
        name, size = lista[prov]
        parquet = OUT / f"esqueleto_{prov:02d}.parquet"
        print(f"[{prov:02d}] {name} ({size / 1e6:.0f} MB)")
        zip_path = RAW_SIGPAC / f"{YEAR}_recintos" / name
        extraido = list((RAW_SIGPAC / "extract" / f"{prov:02d}_recintos").glob("*.gpkg"))
        if parquet.exists() and (extraido or borrar_bruto):
            print("  ya procesado")
            continue
        download(f"{BASE}/geopackages/{YEAR}/recintos/{quote(name)}", zip_path, f"FEGA SIGPAC recintos {YEAR}",
                 expected_size=size, licencia="CC BY 4.0", provincia=prov)
        gpkg = _extraer(zip_path, prov)
        if not parquet.exists():
            df = esqueleto(gpkg, prov)
            df.to_parquet(parquet, index=False)
            print(f"  {len(df):,} recintos, {df['parcela_id'].nunique():,} fincas -> {parquet.name}")
        if borrar_zip:
            zip_path.unlink(missing_ok=True)  # the extracted GeoPackage is enough to rasterise
        if borrar_bruto:
            shutil.rmtree(gpkg.parent, ignore_errors=True)
            zip_path.unlink(missing_ok=True)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--provincias", default="29", help="Comma-separated codes, or 'all'")
    ap.add_argument("--borrar-bruto", action="store_true",
                    help="Delete zip and gpkg when finished (prevents rasterising afterwards)")
    ap.add_argument("--borrar-zip", action="store_true", help="Delete the zip after extracting it (saves disk)")
    a = ap.parse_args()
    provs = sorted(listar()) if a.provincias == "all" else [int(p) for p in a.provincias.split(",")]
    run(provs, a.borrar_bruto, a.borrar_zip)


if __name__ == "__main__":
    main()
