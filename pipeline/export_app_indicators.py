#!/usr/bin/env python3
"""Exporta los indicadores de Antequera para la app web.

Filtra `data/processed/indicators.json` por municipio y comprueba que cada
`parcela_id` existe en el GeoJSON que usa la app. Así la app no carga las 60
fincas de la provincia ni datos de municipios que no puede pintar.

Uso:
    python3 pipeline/export_app_indicators.py
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
INDICATORS = BASE_DIR / "data" / "processed" / "indicators.json"
GEOJSON = BASE_DIR / "app" / "public" / "data" / "fincas_antequera.geojson"
OUT = BASE_DIR / "app" / "public" / "data" / "indicators_antequera.json"


def exportar(
    indicators_path: Path = INDICATORS,
    geojson_path: Path = GEOJSON,
    out_path: Path = OUT,
    municipio: str = "Antequera",
) -> dict:
    data = json.loads(indicators_path.read_text(encoding="utf-8"))
    geo = json.loads(geojson_path.read_text(encoding="utf-8"))
    pids = {f["properties"]["pid"] for f in geo["features"]}

    candidates = [c for c in data["candidates"] if c.get("municipio") == municipio]
    if not candidates:
        raise ValueError(f"No hay candidatas de {municipio} en {indicators_path}")

    faltan = sorted(c["parcela_id"] for c in candidates if c["parcela_id"] not in pids)
    if faltan:
        raise ValueError(
            f"{len(faltan)} parcelas no están en {geojson_path}: {faltan[:5]}"
        )

    top: dict[str, Counter] = {
        profile: Counter() for profile in data.get("profiles", {})
    }
    for candidate in candidates:
        for rid, rotation in candidate["rotations"].items():
            for profile in top:
                if rotation["rankings"][profile]["rank"] == 1:
                    top[profile][rid] += 1

    salida = dict(data)
    salida["candidates"] = candidates
    salida["summary"] = {
        **data.get("summary", {}),
        "fincas": len(candidates),
        "top_por_perfil": {
            profile: dict(counts.most_common()) for profile, counts in top.items()
        },
    }
    salida["app_export"] = {
        "municipio": municipio,
        "parcela_ids": len(candidates),
        "geojson": str(geojson_path.relative_to(BASE_DIR)),
        "source": str(indicators_path.relative_to(BASE_DIR)),
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(salida, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return salida


def main() -> None:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--indicators", type=Path, default=INDICATORS)
    ap.add_argument("--geojson", type=Path, default=GEOJSON)
    ap.add_argument("--out", type=Path, default=OUT)
    ap.add_argument("--municipio", default="Antequera")
    args = ap.parse_args()

    data = exportar(args.indicators, args.geojson, args.out, args.municipio)
    print(
        f"{len(data['candidates'])} fincas de {args.municipio} -> "
        f"{args.out.relative_to(BASE_DIR)}"
    )
    print(f"Tamaño: {args.out.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
