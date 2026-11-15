"""Daily POWER climate per MERRA-2 cell (0.5° × 0.625°) and indicators per season.

Source: https://power.larc.nasa.gov/ (LaRC POWER, AG community, no key).

A daily 2001–2025 series is downloaded per cell (not per farm) and indicators are
summarised per agricultural season (October of the previous year to September).

Usage:
    python -m pipeline.power --provincias 29
"""

from __future__ import annotations

import argparse
import json

import numpy as np
import pandas as pd

from pipeline.common import PROCESSED, RAW, record, session

API = "https://power.larc.nasa.gov/api/temporal/daily/point"
PARAMS = [
    "PRECTOTCORR",  # mm/day
    "T2M",  # °C
    "T2M_MAX",  # °C
    "T2M_MIN",  # °C
    "TOA_SW_DWN",  # MJ/m²/day, extraterrestrial radiation (Ra)
    "ALLSKY_SFC_SW_DWN",  # MJ/m²/day
    "GWETTOP",  # 0–1, surface soil moisture, 0–5 cm (MERRA-2)
    "GWETROOT",  # 0–1, root-zone moisture, 0–100 cm (MERRA-2)
    "GWETPROF",  # 0–1, whole-profile moisture (MERRA-2)
    "RH2M",  # %
    "WS2M",  # m/s
]
START, END = "20010101", "20251231"
DLAT, DLON = 0.5, 0.625
RAW_POWER = RAW / "power"
OUT = PROCESSED / "power"


def celda(lat: pd.Series, lon: pd.Series) -> pd.DataFrame:
    """Centre of the MERRA-2 cell and a stable integer id."""
    ilat = np.round((lat + 90) / DLAT).astype(int)
    ilon = np.round((lon + 180) / DLON).astype(int)
    return pd.DataFrame(
        {
            "celda_power": ilat * 1000 + ilon,
            "celda_lat": ilat * DLAT - 90,
            "celda_lon": ilon * DLON - 180,
        },
        index=lat.index,
    )


def descargar(celda_id: int, lat: float, lon: float) -> pd.DataFrame:
    f = RAW_POWER / f"celda_{celda_id}_{START}_{END}.json"
    params = {
        "parameters": ",".join(PARAMS),
        "community": "AG",
        "latitude": lat,
        "longitude": lon,
        "start": START,
        "end": END,
        "format": "JSON",
        "time-standard": "LST",
    }
    if not f.exists():
        RAW_POWER.mkdir(parents=True, exist_ok=True)
        r = session().get(API, params=params, timeout=300)
        r.raise_for_status()
        f.write_bytes(r.content)
        record("POWER daily", r.url, f, celda_power=celda_id, lat=lat, lon=lon)
    data = json.loads(f.read_text())["properties"]["parameter"]
    df = pd.DataFrame(data)
    df.index = pd.to_datetime(df.index, format="%Y%m%d")
    return df.replace(-999.0, np.nan)


def indicadores(d: pd.DataFrame) -> pd.DataFrame:
    """Indicators per agricultural season (Oct of the previous year to Sep)."""
    d = d.copy()
    d["campana"] = d.index.year + (d.index.month >= 10)
    m = d.index.month
    # Hargreaves-Samani ET0 (mm/day); Ra in MJ/m²/day × 0.408 = mm/day.
    amp = (d["T2M_MAX"] - d["T2M_MIN"]).clip(lower=0)
    d["ET0"] = 0.0023 * (d["T2M"] + 17.8) * np.sqrt(amp) * d["TOA_SW_DWN"] * 0.408
    d["lluvia_oct_may"] = d["PRECTOTCORR"].where((m >= 10) | (m <= 5))
    d["calor_may_jun"] = ((d["T2M_MAX"] >= 32) & m.isin([5, 6])).astype(int)
    d["calor_jul_ago"] = ((d["T2M_MAX"] >= 35) & m.isin([7, 8])).astype(int)
    d["helada"] = (d["T2M_MIN"] <= 0).astype(int)
    d["helada_tardia"] = ((d["T2M_MIN"] <= 0) & m.isin([3, 4])).astype(int)
    d["gwet_mar_may"] = d["GWETROOT"].where(m.isin([3, 4, 5]))
    d["gwet_oct_nov"] = d["GWETTOP"].where(m.isin([10, 11]))  # soil moisture at autumn sowing
    g = d.groupby("campana")
    out = pd.DataFrame(
        {
            "dias": g.size(),
            "lluvia_mm": g["PRECTOTCORR"].sum(),
            "lluvia_oct_may_mm": g["lluvia_oct_may"].sum(),
            "et0_mm": g["ET0"].sum(),
            "tmedia_c": g["T2M"].mean(),
            "tmax_abs_c": g["T2M_MAX"].max(),
            "tmin_abs_c": g["T2M_MIN"].min(),
            "dias_calor_may_jun": g["calor_may_jun"].sum(),
            "dias_calor_jul_ago": g["calor_jul_ago"].sum(),
            "dias_helada": g["helada"].sum(),
            "dias_helada_mar_abr": g["helada_tardia"].sum(),
            "radiacion_mj_m2_dia": g["ALLSKY_SFC_SW_DWN"].mean(),
            # Soil moisture (fraction 0–1 of saturation, MERRA-2 via POWER)
            "gwettop_media": g["GWETTOP"].mean(),
            "gwetroot_media": g["GWETROOT"].mean(),
            "gwetprof_media": g["GWETPROF"].mean(),
            "gwetroot_mar_may": g["gwet_mar_may"].mean(),
            "gwettop_oct_nov": g["gwet_oct_nov"].mean(),
            "gwetroot_min": g["GWETROOT"].min(),
        }
    )
    out["deficit_mm"] = out["et0_mm"] - out["lluvia_mm"]
    out = out[out["dias"] >= 360].drop(columns="dias")  # complete seasons only
    # Spring root-zone moisture anomaly with respect to the cell mean.
    out["gwetroot_mar_may_anomalia"] = out["gwetroot_mar_may"] - out["gwetroot_mar_may"].mean()
    return out.round(2).reset_index()


def resumen(anual: pd.DataFrame) -> dict:
    ll = anual["lluvia_mm"]
    return {
        "campanas": len(anual),
        "lluvia_media_mm": ll.mean(),
        "lluvia_p20_mm": ll.quantile(0.2),  # "dry year": 1 in 5
        "lluvia_cv": ll.std() / ll.mean(),
        "campana_mas_seca": int(anual.loc[ll.idxmin(), "campana"]),
        "lluvia_min_mm": ll.min(),
        "lluvia_oct_may_media_mm": anual["lluvia_oct_may_mm"].mean(),
        "et0_media_mm": anual["et0_mm"].mean(),
        "deficit_medio_mm": anual["deficit_mm"].mean(),
        "dias_calor_may_jun_media": anual["dias_calor_may_jun"].mean(),
        "dias_calor_jul_ago_media": anual["dias_calor_jul_ago"].mean(),
        "dias_helada_media": anual["dias_helada"].mean(),
        "dias_helada_mar_abr_media": anual["dias_helada_mar_abr"].mean(),
        "gwetroot_media": anual["gwetroot_media"].mean(),
        "gwetroot_mar_may_media": anual["gwetroot_mar_may"].mean(),
        "gwetroot_mar_may_p20": anual["gwetroot_mar_may"].quantile(0.2),
    }


def run(provincias: list[int]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    pts = pd.concat(
        pd.read_parquet(PROCESSED / "sigpac" / f"esqueleto_{p:02d}.parquet", columns=["lat", "lon"])
        for p in provincias
    )
    celdas = celda(pts["lat"], pts["lon"]).drop_duplicates("celda_power").sort_values("celda_power")
    print(f"{len(celdas)} POWER cells for {len(pts):,} enclosures")
    anuales, resumenes = [], []
    for c in celdas.itertuples(index=False):
        print(f"  cell {c.celda_power} ({c.celda_lat}, {c.celda_lon})")
        anual = indicadores(descargar(c.celda_power, c.celda_lat, c.celda_lon))
        anual.insert(0, "celda_power", c.celda_power)
        anuales.append(anual)
        resumenes.append({"celda_power": c.celda_power, "lat": c.celda_lat, "lon": c.celda_lon, **resumen(anual)})
    pd.concat(anuales).to_parquet(OUT / "clima_anual.parquet", index=False)
    pd.DataFrame(resumenes).round(3).to_parquet(OUT / "celdas.parquet", index=False)
    print(f"-> {OUT}/clima_anual.parquet, celdas.parquet")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--provincias", default="29")
    run([int(p) for p in ap.parse_args().provincias.split(",")])


if __name__ == "__main__":
    main()
