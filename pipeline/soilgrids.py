"""SoilGrids 2.0 soil (ISRIC, 250 m) per farm.

Source: https://maps.isric.org/ (WCS 2.0.1, CC BY 4.0, no key).
Exception to the "only resources.md" rule, requested by the team (action plan:
"SSURGO … becomes … SoilGrids"): SSURGO/NRCS in resources.md only covers the US.

One crop is downloaded per property and depth for the bbox of the province in the
native projection (Homolosine), sampled at the centroid of each enclosure and
averaged per farm weighted by area. Returns the 0–30 cm mean and the available
water capacity (CAD) 0–100 cm estimated with Saxton & Rawls (2006).

Usage:
    python -m pipeline.soilgrids --provincias 29
"""

from __future__ import annotations

import argparse

import numpy as np
import pandas as pd
import rasterio
import requests
from pyproj import Transformer

from pipeline.common import PROCESSED, RAW, en_manifiesto, record, session
from pipeline.sigpac import cargar_esqueleto

WCS = "https://maps.isric.org/mapserv?map=/map/{prop}.map"
IGH = "+proj=igh +lat_0=0 +lon_0=0 +datum=WGS84 +units=m +no_defs"
# depth: thickness in cm
PROF = {"0-5cm": 5, "5-15cm": 10, "15-30cm": 15, "30-60cm": 30, "60-100cm": 40}
TOP = ["0-5cm", "5-15cm", "15-30cm"]
# property: (output name, divisor to conventional unit, depths)
PROPS = {
    "clay": ("arcilla_pct", 10, list(PROF)),  # g/kg -> %
    "sand": ("arena_pct", 10, list(PROF)),
    "soc": ("cos_gkg", 10, list(PROF)),  # dg/kg -> g/kg
    "cfvo": ("gruesos_pct", 10, list(PROF)),  # cm³/dm³ -> % vol
    "silt": ("limo_pct", 10, TOP),
    "phh2o": ("ph_h2o", 10, TOP),
    "bdod": ("densidad_gcm3", 100, TOP),  # cg/cm³ -> g/cm³
    "nitrogen": ("nitrogeno_gkg", 100, TOP),  # cg/kg -> g/kg
    "cec": ("cic_cmolkg", 10, TOP),  # mmol(c)/kg -> cmol(c)/kg
}
RAW_SG = RAW / "soilgrids"
OUT = PROCESSED / "soilgrids"


def recorte(prop: str, prof: str, bbox_igh: tuple[float, float, float, float], tag: str):
    f = RAW_SG / tag / f"{prop}_{prof}_mean.tif"
    x0, y0, x1, y1 = bbox_igh
    params = {
        "SERVICE": "WCS",
        "VERSION": "2.0.1",
        "REQUEST": "GetCoverage",
        "COVERAGEID": f"{prop}_{prof}_mean",
        "FORMAT": "image/tiff",
        "SUBSET": [f"X({x0:.0f},{x1:.0f})", f"Y({y0:.0f},{y1:.0f})"],
    }
    if not f.exists():
        f.parent.mkdir(parents=True, exist_ok=True)
        r = session().get(WCS.format(prop=prop), params=params, timeout=300)
        r.raise_for_status()
        if not r.content.startswith((b"II*", b"MM\x00*")):
            raise RuntimeError(f"SoilGrids {prop} {prof}: {r.text[:300]}")
        f.write_bytes(r.content)
    if not en_manifiesto(f):
        url = requests.Request("GET", WCS.format(prop=prop), params=params).prepare().url
        record("ISRIC SoilGrids 2.0", url, f, licencia="CC BY 4.0")
    return f


def muestrear(tif, x: np.ndarray, y: np.ndarray) -> np.ndarray:
    with rasterio.open(tif) as r:
        a = r.read(1).astype("float64")
        rows, cols = rasterio.transform.rowcol(r.transform, x, y)
    rows, cols = np.asarray(rows), np.asarray(cols)
    ok = (rows >= 0) & (rows < a.shape[0]) & (cols >= 0) & (cols < a.shape[1])
    out = np.full(len(x), np.nan)
    out[ok] = a[rows[ok], cols[ok]]
    out[out <= 0] = np.nan  # 0 = no data (water, urban) in SoilGrids
    return out


def saxton_rawls(arena_pct, arcilla_pct, cos_gkg):
    """Available water (θ33 − θ1500, volumetric fraction). Saxton & Rawls 2006."""
    s, c = arena_pct / 100, arcilla_pct / 100
    om = np.clip(cos_gkg / 10 * 1.724, 0, 8)  # organic matter %
    t1500 = -0.024 * s + 0.487 * c + 0.006 * om + 0.005 * s * om - 0.013 * c * om + 0.068 * s * c + 0.031
    t1500 = t1500 + (0.14 * t1500 - 0.02)
    t33 = -0.251 * s + 0.195 * c + 0.011 * om + 0.006 * s * om - 0.027 * c * om + 0.452 * s * c + 0.299
    t33 = t33 + (1.283 * t33**2 - 0.374 * t33 - 0.015)
    return np.clip(t33 - t1500, 0, None)


def run(provincias: list[int]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    to_igh = Transformer.from_crs("EPSG:4326", IGH, always_xy=True)
    todos, _ = cargar_esqueleto(provincias)
    partes = []
    for prov in provincias:
        rec = todos[todos["_prov"] == prov].reset_index(drop=True)
        lo0, lo1 = rec.lon.min() - 0.02, rec.lon.max() + 0.02
        la0, la1 = rec.lat.min() - 0.02, rec.lat.max() + 0.02
        xs, ys = to_igh.transform([lo0, lo0, lo1, lo1], [la0, la1, la0, la1])
        bbox = (min(xs), min(ys), max(xs), max(ys))
        x, y = to_igh.transform(rec.lon.to_numpy(), rec.lat.to_numpy())
        out = pd.DataFrame({"finca_idx": rec["finca_idx"], "superficie_ha": rec["superficie_ha"]})
        capas: dict[tuple[str, str], np.ndarray] = {}
        for prop, (nombre, div, profs) in PROPS.items():
            for prof in profs:
                tif = recorte(prop, prof, bbox, f"{prov:02d}")
                capas[(prop, prof)] = muestrear(tif, np.asarray(x), np.asarray(y)) / div
            # weighted mean 0–30 cm
            peso = np.array([PROF[p] for p in TOP], dtype=float)
            pila = np.vstack([capas[(prop, p)] for p in TOP])
            out[nombre] = np.round(np.nansum(pila * peso[:, None], axis=0) / peso.sum(), 2)
            out.loc[np.isnan(pila).all(axis=0), nombre] = np.nan
            print(f"  [{prov:02d}] {prop}: {np.isfinite(out[nombre]).mean():.1%} recintos con dato")
        # CAD 0–100 cm (mm), discounting coarse fragments
        cad = np.zeros(len(out))
        for prof, grosor_cm in PROF.items():
            awc = saxton_rawls(capas[("sand", prof)], capas[("clay", prof)], capas[("soc", prof)])
            gruesos = np.nan_to_num(capas[("cfvo", prof)], nan=0) / 100
            cad += awc * (1 - gruesos) * grosor_cm * 10
        out["cad_0_100_mm"] = cad
        out.loc[out["arcilla_pct"].isna(), "cad_0_100_mm"] = np.nan
        partes.append(out)
    # Mean per farm weighted by the area of each enclosure with data
    r = pd.concat(partes)
    cols = [n for n, _, _ in PROPS.values()] + ["cad_0_100_mm"]
    w = r["superficie_ha"].clip(lower=1e-6).where(r["arcilla_pct"].notna())
    suelo = (r[cols].mul(w, axis=0).groupby(r["finca_idx"]).sum(min_count=1)
             .div(w.groupby(r["finca_idx"]).sum(min_count=1), axis=0))
    suelo["pct_superficie_con_dato"] = (w.groupby(r["finca_idx"]).sum()
                                        / r["superficie_ha"].clip(lower=1e-6).groupby(r["finca_idx"]).sum() * 100)
    suelo = suelo.round({**{c: 2 for c in cols}, "cad_0_100_mm": 1, "pct_superficie_con_dato": 1}).reset_index()
    suelo.to_parquet(OUT / "suelo_fincas.parquet", index=False)
    print(f"  -> suelo_fincas.parquet ({suelo['arcilla_pct'].notna().sum():,} de {len(suelo):,} farms with data)")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--provincias", default="29")
    run([int(p) for p in ap.parse_args().provincias.split(",")])


if __name__ == "__main__":
    main()
