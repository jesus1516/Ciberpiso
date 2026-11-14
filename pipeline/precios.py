"""Precios agrarios de venta en España (Eurostat, serie anual desde 2000).

Fuente: Eurostat `apri_ap_crpouta`, "Selling prices of crop products (absolute prices)
- annual price". API abierta, sin clave:
https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/apri_ap_crpouta
Son los precios medios nacionales que España (Ministerio de Agricultura) comunica a la
Comisión Europea. Excepción a la regla "solo resources.md", aprobada por el equipo:
la lista solo tiene precios de EE. UU. (AMS, QuickStats).

Nota: se intentó primero la API semanal de la Comisión (agridata, por mercado), pero
el 14-11-2026 devolvía error 500 incluso con los ejemplos de su documentación.

Uso:
    python -m pipeline.precios
"""

from __future__ import annotations

import json
import re

import pandas as pd

from pipeline.common import PROCESSED, RAW, record, session

URL = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/apri_ap_crpouta"
PARAMS = {"geo": "ES", "currency": "EUR", "lang": "EN"}
RAW_F = RAW / "precios" / "eurostat_apri_ap_crpouta_ES.json"
OUT = PROCESSED / "precios"

# Nombre en español y grupo de rotación de los productos que importan al caso
PRODUCTOS = {
    "01110000": ("Trigo blando", "cereal_invierno"),
    "01120000": ("Trigo duro", "cereal_invierno"),
    "01200000": ("Centeno", "cereal_invierno"),
    "01300000": ("Cebada", "cereal_invierno"),
    "01310000": ("Cebada pienso", "cereal_invierno"),
    "01320000": ("Cebada maltera", "cereal_invierno"),
    "01400000": ("Avena", "cereal_invierno"),
    "01920000": ("Triticale", "cereal_invierno"),
    "01500000": ("Maíz", "cereal_verano"),
    "01910000": ("Sorgo", "cereal_verano"),
    "01600000": ("Arroz", "cereal_verano"),
    "02120000": ("Girasol", "girasol"),
    "02110000": ("Colza", "oleaginosa_otra"),
    "02130000": ("Soja", "oleaginosa_otra"),
    "02210000": ("Guisante seco", "leguminosa_grano"),
    "02220000": ("Judía seca", "leguminosa_grano"),
    "02230000": ("Haba seca", "leguminosa_grano"),
    "02991000": ("Lenteja", "leguminosa_grano"),
    "02992000": ("Garbanzo", "leguminosa_grano"),
    "06510000": ("Aceituna de mesa", "olivar"),
    "06590000": ("Aceituna (otras)", "olivar"),
    "08100000": ("Aceite de oliva virgen extra", "olivar"),
    "08500000": ("Aceite de oliva virgen", "olivar"),
    "08400000": ("Aceite de oliva lampante", "olivar"),
    "06194130": ("Almendra", "lenoso_otro"),
}
MASA_A_T = {"100 kg": 10, "1000 kg": 1}  # factor a €/t


def descargar() -> dict:
    if not RAW_F.exists():
        RAW_F.parent.mkdir(parents=True, exist_ok=True)
        r = session().get(URL, params=PARAMS, timeout=120)
        r.raise_for_status()
        RAW_F.write_bytes(r.content)
        record("Eurostat apri_ap_crpouta", r.url, RAW_F, licencia="CC BY 4.0 (Eurostat)")
    return json.loads(RAW_F.read_text(encoding="utf-8"))


def normalizar(js: dict) -> tuple[pd.DataFrame, pd.DataFrame]:
    """JSON-stat → (dimensión de productos, precios en formato largo)."""
    dims, size = js["id"], js["size"]
    cat = {k: js["dimension"][k]["category"] for k in dims}
    orden = {k: sorted(cat[k]["index"], key=cat[k]["index"].get) for k in dims}
    filas = []
    for pos_txt, valor in js["value"].items():
        pos, coords = int(pos_txt), {}
        for k, n in zip(reversed(dims), reversed(size)):
            coords[k] = orden[k][pos % n]
            pos //= n
        filas.append({"producto_codigo": coords["prod_veg"], "anio": int(coords["time"]), "precio_eur": valor,
                      "estado": js.get("status", {}).get(pos_txt)})
    precios = pd.DataFrame(filas)

    dim = []
    for codigo, etiqueta in cat["prod_veg"]["label"].items():
        m = re.match(r"(.*?)\s*-\s*prices? per (.+)$", etiqueta, flags=re.I)
        nombre, unidad = (m.group(1), m.group(2).lower()) if m else (etiqueta, None)
        es, grupo = PRODUCTOS.get(codigo, (None, "otro"))
        dim.append({"producto_codigo": codigo, "producto": nombre.strip(), "producto_es": es,
                    "unidad": unidad, "grupo": grupo})
    dim = pd.DataFrame(dim)
    dim = dim[dim["producto_codigo"].isin(precios["producto_codigo"])]

    precios = precios.merge(dim[["producto_codigo", "unidad"]], on="producto_codigo")
    factor = precios.pop("unidad").map(MASA_A_T)
    precios["precio_eur_t"] = (precios["precio_eur"] * factor).round(2)
    precios = precios[["producto_codigo", "anio", "precio_eur", "precio_eur_t", "estado"]]
    return dim.sort_values("producto_codigo"), precios.sort_values(["producto_codigo", "anio"])


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    dim, precios = normalizar(descargar())
    dim.to_parquet(OUT / "dim_producto_precio.parquet", index=False)
    precios.to_parquet(OUT / "precios_anuales.parquet", index=False)
    print(f"{len(dim)} productos, {len(precios)} precios ({precios['anio'].min()}–{precios['anio'].max()}) -> {OUT}")


if __name__ == "__main__":
    main()
