"""Datos por finca desde Microsoft Planetary Computer (resources.md).

Colecciones (STAC https://planetarycomputer.microsoft.com/api/stac/v1, acceso anónimo):
    nasadem          NASA NASADEM (SRTM reprocesado), 1": altitud y pendiente
    esa-worldcover   ESA WorldCover 2021 v200, 10 m: cobertura del suelo
    modis-13Q1-061   NASA MODIS Terra MOD13Q1 v6.1 (LP DAAC), 250 m / 16 días: NDVI

Las fincas (esqueleto SIGPAC) se rasterizan en una rejilla común de 1/4000° (~25 m) y
cada variable se promedia con todos los píxeles de la finca. Las fincas demasiado
pequeñas para tener un píxel propio toman el valor del píxel de su centroide.

Uso:
    python -m pipeline.pc --provincias 29
"""

from __future__ import annotations

import argparse
import warnings
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import planetary_computer
import pyogrio
import rasterio
import rasterio.warp
import rasterio.windows
from pystac_client import Client
from rasterio.enums import Resampling
from rasterio.features import rasterize
from rasterio.merge import merge
from rasterio.transform import from_origin, rowcol
from rasterio.warp import reproject

from pipeline.common import PROCESSED, RAW, record
from pipeline.sigpac import cargar_esqueleto, gpkg_de

STAC = "https://planetarycomputer.microsoft.com/api/stac/v1"
RES = 1 / 4000  # grados; múltiplo exacto del píxel de WorldCover (1/12000°)
WC_CLASES = {10: "arbolado", 20: "matorral", 30: "pasto", 40: "cultivo", 50: "urbano", 60: "suelo_desnudo", 80: "agua"}
MODIS_INICIO, MODIS_FIN = "2019-10-01", "2025-09-30"  # campañas 2020–2025
RAW_PC = RAW / "pc"
OUT = PROCESSED / "pc"
GDAL_ENV = dict(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GDAL_HTTP_MAX_RETRY="5", GDAL_HTTP_RETRY_DELAY="3",
                CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif,.TIF")


# ---------------------------------------------------------------------------------- rejilla
class Rejilla:
    def __init__(self, lon: pd.Series, lat: pd.Series, margen: float = 0.01):
        self.w = np.floor((lon.min() - margen) / RES) * RES
        self.e = np.ceil((lon.max() + margen) / RES) * RES
        self.s = np.floor((lat.min() - margen) / RES) * RES
        self.n = np.ceil((lat.max() + margen) / RES) * RES
        self.width = int(round((self.e - self.w) / RES))
        self.height = int(round((self.n - self.s) / RES))
        self.transform = from_origin(self.w, self.n, RES, RES)
        self.bounds = (self.w, self.s, self.e, self.n)

    def perfil(self, dtype: str, nodata) -> dict:
        return dict(driver="GTiff", width=self.width, height=self.height, count=1, dtype=dtype, crs="EPSG:4326",
                    transform=self.transform, nodata=nodata, compress="deflate", tiled=True)

    def celda(self, lon, lat) -> tuple[np.ndarray, np.ndarray]:
        r, c = rowcol(self.transform, np.asarray(lon), np.asarray(lat))
        return (np.clip(np.asarray(r), 0, self.height - 1), np.clip(np.asarray(c), 0, self.width - 1))


def etiquetas(prov: int, rec: pd.DataFrame, g: Rejilla, base: int) -> np.ndarray:
    """Raster con el índice local de finca de cada píxel (finca_idx - base; 0 = sin finca).

    El índice es local a la provincia, así el ráster sigue valiendo aunque cambie la
    lista de provincias procesadas.
    """
    f = RAW_PC / f"fincas_local_{prov:02d}.tif"
    if f.exists():
        with rasterio.open(f) as r:
            return r.read(1)
    gdf = pyogrio.read_dataframe(gpkg_de(prov), layer="recinto", columns=[], use_arrow=True)
    sub = rec[rec["_prov"] == prov].sort_values("fid")
    shapes = zip(gdf.geometry.iloc[sub["fid"].to_numpy()], (sub["finca_idx"] - base).to_numpy())
    lab = rasterize(shapes, out_shape=(g.height, g.width), transform=g.transform, fill=0, dtype="int32")
    with rasterio.open(f, "w", **g.perfil("int32", 0)) as dst:
        dst.write(lab, 1)
    return lab


def zonal(lab: np.ndarray, valores: np.ndarray, n: int, centro: tuple):
    """Media por finca y nº de píxeles; las fincas sin píxeles usan el píxel del centroide."""
    v = valores.ravel()
    idx = lab.ravel()
    ok = (idx > 0) & np.isfinite(v)
    s = np.bincount(idx[ok], weights=v[ok], minlength=n + 1)
    c = np.bincount(idx[ok], minlength=n + 1)
    with np.errstate(invalid="ignore", divide="ignore"):
        out = s / c
    falta = ~np.isfinite(out[1:])
    out[1:][falta] = valores[centro[0][falta], centro[1][falta]]
    return out[1:], c[1:]


def _items(cat: Client, col: str, g: Rejilla, fecha: str | None = None):
    return list(cat.search(collections=[col], bbox=list(g.bounds), datetime=fecha).items())


# ---------------------------------------------------------------------------------- NASADEM
def nasadem(cat: Client, prov: int, g: Rejilla) -> np.ndarray:
    f = RAW_PC / f"nasadem_{prov:02d}.tif"
    if not f.exists():
        items = _items(cat, "nasadem", g)
        with rasterio.Env(**GDAL_ENV):
            srcs = [rasterio.open(planetary_computer.sign(i.assets["elevation"].href)) for i in items]
            mosaico, tr = merge(srcs, bounds=g.bounds, nodata=-32768)
            dst = np.full((g.height, g.width), np.nan, dtype="float32")
            reproject(mosaico[0].astype("float32"), dst, src_transform=tr, src_crs=srcs[0].crs, src_nodata=-32768,
                      dst_transform=g.transform, dst_crs="EPSG:4326", dst_nodata=np.nan,
                      resampling=Resampling.bilinear)
        with rasterio.open(f, "w", **g.perfil("float32", np.nan)) as out:
            out.write(dst, 1)
        record("NASA NASADEM (Planetary Computer)", f"{STAC}/collections/nasadem", f,
               items=[i.id for i in items])
    with rasterio.open(f) as r:
        return r.read(1)


def pendiente(dem: np.ndarray, g: Rejilla) -> np.ndarray:
    lat = g.n - (np.arange(g.height) + 0.5) * RES
    dy = RES * 110_574.0
    dx = RES * 111_320.0 * np.cos(np.radians(lat))[:, None]
    gy, gx = np.gradient(dem)
    return (100 * np.hypot(gx / dx, gy / dy)).astype("float32")


# ---------------------------------------------------------------------------------- WorldCover
def worldcover(cat: Client, prov: int, g: Rejilla) -> np.ndarray:
    """Clases WorldCover 2021 a 10 m sobre la rejilla ×3 (alineada)."""
    f = RAW_PC / f"worldcover2021_{prov:02d}.tif"
    if not f.exists():
        items = _items(cat, "esa-worldcover", g, "2021-01-01/2021-12-31")
        with rasterio.Env(**GDAL_ENV):
            srcs = [rasterio.open(planetary_computer.sign(i.assets["map"].href)) for i in items]
            mosaico, _ = merge(srcs, bounds=g.bounds, res=RES / 3, nodata=0)
        a = np.zeros((g.height * 3, g.width * 3), dtype="uint8")
        h, w = min(a.shape[0], mosaico.shape[1]), min(a.shape[1], mosaico.shape[2])
        a[:h, :w] = mosaico[0, :h, :w]
        perfil = g.perfil("uint8", 0) | dict(width=a.shape[1], height=a.shape[0],
                                             transform=from_origin(g.w, g.n, RES / 3, RES / 3))
        with rasterio.open(f, "w", **perfil) as out:
            out.write(a, 1)
        record("ESA WorldCover 2021 v200 (Planetary Computer)", f"{STAC}/collections/esa-worldcover", f,
               items=[i.id for i in items], licencia="CC BY 4.0")
    with rasterio.open(f) as r:
        return r.read(1)


# ---------------------------------------------------------------------------------- MODIS NDVI
def modis(cat: Client, prov: int, g: Rejilla) -> list[tuple[pd.Timestamp, Path]]:
    """Recorta NDVI (calidad buena o marginal) de cada compuesto MOD13Q1 a la rejilla."""
    d = RAW_PC / f"modis_{prov:02d}"
    d.mkdir(parents=True, exist_ok=True)
    # El catálogo tiene a veces varias versiones (reprocesados) del mismo compuesto:
    # nos quedamos con la de producción más reciente (último campo del id).
    por_compuesto: dict[str, object] = {}
    for i in _items(cat, "modis-13Q1-061", g, f"{MODIS_INICIO}/{MODIS_FIN}"):
        clave = i.id.split(".")[1]  # AYYYYDDD
        if i.id.startswith("MOD13Q1") and (clave not in por_compuesto or i.id > por_compuesto[clave].id):
            por_compuesto[clave] = i
    items = sorted(por_compuesto.values(), key=lambda i: i.properties["start_datetime"])

    def uno(item):
        fecha = pd.Timestamp(item.properties["start_datetime"]).tz_localize(None) + timedelta(days=8)
        f = d / f"{item.id.split('.')[1]}_ndvi.tif"
        if f.exists():
            return fecha, f
        with rasterio.Env(**GDAL_ENV):
            src = rasterio.open(planetary_computer.sign(item.assets["250m_16_days_NDVI"].href))
            rel_src = rasterio.open(planetary_computer.sign(item.assets["250m_16_days_pixel_reliability"].href))
            win = rasterio.windows.from_bounds(
                *rasterio.warp.transform_bounds("EPSG:4326", src.crs, *g.bounds), src.transform
            ).round_offsets().round_lengths()
            ndvi = src.read(1, window=win, boundless=True, fill_value=-3000).astype("float32")
            rel = rel_src.read(1, window=win, boundless=True, fill_value=-1)
            ndvi[(ndvi <= -3000) | ~np.isin(rel, [0, 1])] = np.nan
            ndvi *= 0.0001
            dst = np.full((g.height, g.width), np.nan, dtype="float32")
            reproject(ndvi, dst, src_transform=src.window_transform(win), src_crs=src.crs, src_nodata=np.nan,
                      dst_transform=g.transform, dst_crs="EPSG:4326", dst_nodata=np.nan,
                      resampling=Resampling.nearest)
        with rasterio.open(f, "w", **g.perfil("float32", np.nan)) as out:
            out.write(dst, 1)
        record("NASA MODIS MOD13Q1 v6.1 NDVI (Planetary Computer)", f"{STAC}/collections/modis-13Q1-061", f,
               item=item.id, fecha=str(fecha.date()))
        return fecha, f

    with ThreadPoolExecutor(6) as ex:
        return list(ex.map(uno, items))


# ---------------------------------------------------------------------------------- fenología
def fenologia(ndvi: np.ndarray, fechas: pd.DatetimeIndex) -> pd.DataFrame:
    """Métricas NDVI por finca y campaña (oct–sep) y clase de cultivo estimada (heurística)."""
    campana = fechas.year + (fechas.month >= 10)
    mes = fechas.month.to_numpy()
    filas = []
    for c in np.unique(campana):
        sel = np.where(campana == c)[0]
        v = ndvi[:, sel]
        validos = np.isfinite(v).sum(axis=1)
        with np.errstate(all="ignore"), warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)  # fincas sin datos en la campaña
            vmax = np.nanmax(v, axis=1)
            imax = np.argmax(np.where(np.isfinite(v), v, -9), axis=1)
            p10, p90 = np.nanpercentile(v, [10, 90], axis=1)
            inv = np.nanmean(np.where(np.isin(mes[sel], [1, 2, 3, 4]), v, np.nan), axis=1)
            ver = np.nanmean(np.where(np.isin(mes[sel], [6, 7, 8]), v, np.nan), axis=1)
            oto = np.nanmean(np.where(np.isin(mes[sel], [10, 11, 12]), v, np.nan), axis=1)
            media = np.nanmean(v, axis=1)
        mes_max = mes[sel][imax]
        amp = p90 - p10
        # Umbrales calibrados en Málaga con fincas ≥ 80 % de una clase WorldCover (mediana):
        #   cultivo: verano 0,26, amplitud 0,33, otoño ~0,27 (siembra tardía)
        #   pasto:   verano 0,31, amplitud 0,24, otoño ~0,40 (verdea con las primeras lluvias)
        #   arbolado/matorral: verano ≥ 0,40, amplitud ≤ 0,17
        clase = np.select(
            [
                validos < 12,
                vmax < 0.25,
                np.isin(mes_max, [5, 6, 7, 8]) & (vmax - inv >= 0.12) & (ver >= inv),
                np.isin(mes_max, [2, 3, 4, 5]) & (amp >= 0.25) & (ver <= 0.33) & (vmax - oto >= 0.25),
                (amp < 0.2) & (ver >= 0.33),
                ver < 0.4,
            ],
            ["sin_datos", "sin_vegetacion", "herbaceo_verano", "herbaceo_invierno", "permanente",
             "barbecho_o_pastizal"],
            default="mixto",
        )
        filas.append(pd.DataFrame({
            "finca_idx": np.arange(1, ndvi.shape[0] + 1, dtype="int32"), "campana": int(c),
            "n_compuestos": validos, "ndvi_media": media, "ndvi_max": vmax,
            "mes_ndvi_max": np.where(validos > 0, mes_max, 0), "ndvi_amplitud": amp,
            "ndvi_ene_abr": inv, "ndvi_jun_ago": ver, "ndvi_oct_dic": oto, "clase_estimada": clase,
        }))
    return pd.concat(filas).round(3)


# ---------------------------------------------------------------------------------- run
def run(provincias: list[int]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    RAW_PC.mkdir(parents=True, exist_ok=True)
    rec, fincas = cargar_esqueleto(provincias)
    total = int(fincas["finca_idx"].max())
    cat = Client.open(STAC)
    tablas, ndvi, fechas = [], None, None
    for prov in provincias:
        fp = fincas[fincas["provincia"] == prov]
        base, n = int(fp["finca_idx"].min()) - 1, len(fp)
        assert fp["finca_idx"].max() - base == n, "finca_idx no contiguo en la provincia"
        g = Rejilla(rec.loc[rec["_prov"] == prov, "lon"], rec.loc[rec["_prov"] == prov, "lat"])
        print(f"[{prov:02d}] rejilla {g.width}×{g.height}; {n:,} fincas", flush=True)
        lab = etiquetas(prov, rec, g, base)
        centro = g.celda(fp["lon"], fp["lat"])
        out = pd.DataFrame({"finca_idx": fp["finca_idx"].to_numpy()})

        dem = nasadem(cat, prov, g)
        out["altitud_m"], out["n_pixeles"] = zonal(lab, dem, n, centro)
        out["pendiente_pct"], _ = zonal(lab, pendiente(dem, g), n, centro)
        print("  NASADEM listo", flush=True)

        wc = worldcover(cat, prov, g)
        H, W = g.height, g.width
        for cod, nombre in WC_CLASES.items():
            frac = (wc == cod).reshape(H, 3, W, 3).sum(axis=(1, 3), dtype="uint8").astype("float32") * (100 / 9)
            out[f"wc_{nombre}_pct"], _ = zonal(lab, frac, n, centro)
        del wc
        print("  WorldCover listo", flush=True)

        serie = modis(cat, prov, g)
        f_prov = pd.DatetimeIndex([f for f, _ in serie])
        if ndvi is None:
            fechas, ndvi = f_prov, np.full((total, len(serie)), np.nan, dtype="float32")
        if not f_prov.equals(fechas):
            raise RuntimeError(f"Provincia {prov}: compuestos MODIS distintos de las demás")
        filas = fp["finca_idx"].to_numpy() - 1
        for j, (_, f) in enumerate(serie):
            with rasterio.open(f) as r:
                ndvi[filas, j] = zonal(lab, r.read(1), n, centro)[0]
        print(f"  MODIS listo: {len(serie)} compuestos", flush=True)
        tablas.append(out)
        del lab

    pc = pd.concat(tablas).round({"altitud_m": 1, "pendiente_pct": 1, **{f"wc_{v}_pct": 1 for v in WC_CLASES.values()}})
    pc.to_parquet(OUT / "fincas_pc.parquet", index=False)
    np.save(OUT / "ndvi_fincas.npy", ndvi)
    pd.DataFrame({"fecha": fechas}).to_parquet(OUT / "ndvi_fechas.parquet", index=False)
    fenologia(ndvi, fechas).to_parquet(OUT / "fenologia.parquet", index=False)
    print(f"-> {OUT}: fincas_pc.parquet, ndvi_fincas.npy, ndvi_fechas.parquet, fenologia.parquet")


def solo_fenologia() -> None:
    """Recalcula la fenología desde la matriz NDVI guardada (sin descargar nada)."""
    ndvi = np.load(OUT / "ndvi_fincas.npy")
    fechas = pd.DatetimeIndex(pd.read_parquet(OUT / "ndvi_fechas.parquet")["fecha"])
    fenologia(ndvi, fechas).to_parquet(OUT / "fenologia.parquet", index=False)
    print(f"-> {OUT}/fenologia.parquet")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--provincias", default="29")
    ap.add_argument("--solo-fenologia", action="store_true", help="Recalcula clases sin descargar")
    a = ap.parse_args()
    if a.solo_fenologia:
        solo_fenologia()
    else:
        run([int(p) for p in a.provincias.split(",")])


if __name__ == "__main__":
    main()
