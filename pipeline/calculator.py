#!/usr/bin/env python3
"""Calculadora explicable de rotaciones de cultivo (Ciberpiso - Campiña de Antequera).

Lee el catálogo de cultivos y los escenarios reales por finca, calcula las cuatro
rotaciones y escribe `data/processed/indicators.json` para la web. Sin caja negra:
cada nota se puede reconstruir a partir de sus componentes.

Uso:
    python3 pipeline/calculator.py
"""

from __future__ import annotations

import argparse
import csv
import json
import statistics
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
CROPS_PATH = BASE_DIR / "data" / "crops.csv"
SCENARIOS_PATH = BASE_DIR / "data" / "processed" / "scenarios.csv"
OUT_PATH = BASE_DIR / "data" / "processed" / "indicators.json"

ROTATIONS = {
    "R0": {"name": "Trigo-Girasol (Actual)", "crops": ["trigo", "girasol"]},
    "R1": {"name": "Trigo-Girasol-Garbanzo", "crops": ["trigo", "girasol", "garbanzo"]},
    "R2": {"name": "Trigo-Girasol-Veza", "crops": ["trigo", "girasol", "veza"]},
    "R3": {"name": "Trigo-Girasol-Barbecho", "crops": ["trigo", "girasol", "barbecho"]},
}

PROFILES = {
    "water_first": {"water": 0.50, "soil": 0.25, "profit": 0.15, "risk": 0.10},
    "soil_first": {"water": 0.25, "soil": 0.50, "profit": 0.10, "risk": 0.15},
    "profit_first": {"water": 0.15, "soil": 0.10, "profit": 0.60, "risk": 0.15},
}

PRICE_COLS = {
    "trigo": "precio_trigo_eur_t",
    "girasol": "precio_girasol_eur_t",
    "garbanzo": "precio_garbanzo_eur_t",
    "veza": "precio_veza_eur_t",
}

CONFIDENCE = {
    "R0": ("medium", 0.70),
    "R1": ("medium", 0.65),
    "R2": ("low", 0.45),
    "R3": ("medium", 0.70),
}


def leer_csv(path: Path) -> list[dict]:
    if not path.exists():
        raise FileNotFoundError(f"No existe {path}")
    with path.open(newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def load_crops(path: Path = CROPS_PATH) -> dict:
    crops = {}
    for row in leer_csv(path):
        crops[row["crop_id"]] = {
            "water_demand": float(row["water_demand_1_5"]),
            "cover_months": float(row["cover_months"]),
            "nitrogen_fixer": bool(int(row["nitrogen_fixer"])),
            "market_ease": float(row["market_ease_1_5"]),
            "years_weight": float(row["rotation_years"]),
            "risk": row["main_risk"],
        }
    return crops


def load_scenarios(path: Path = SCENARIOS_PATH) -> list[dict]:
    return leer_csv(path)


def _num(value, default=None):
    if value is None or value == "":
        return default
    return float(value)


def latest_price(rows: list[dict], column: str) -> tuple[float | None, int | None]:
    """Ultimo precio disponible; si la campana no lo tiene, usa el anterior."""
    for row in sorted(rows, key=lambda r: int(r["campana"]), reverse=True):
        value = _num(row.get(column))
        if value is not None:
            return value, int(row["campana"])
    return None, None


def planning_scenario(rows: list[dict]) -> dict:
    """Resume las 6 campanas de una finca en el escenario que puntua la calculadora."""
    first = rows[0]
    frost = [_num(r["dias_helada"]) for r in rows if _num(r["dias_helada"]) is not None]
    prices = {}
    price_reference = {}
    for crop, column in PRICE_COLS.items():
        value, year = latest_price(rows, column)
        prices[crop] = value
        price_reference[crop] = {
            "eur_t": value,
            "anio": year,
            "mismo_anio_que_campana": year == 2025,
            "fuente": "Eurostat apri_ap_crpouta",
        }
    prices["barbecho"] = 0.0
    price_reference["barbecho"] = {
        "eur_t": 0.0,
        "anio": None,
        "mismo_anio_que_campana": None,
        "fuente": "Sin ingreso por definicion",
    }

    return {
        "finca_key": first["finca_key"],
        "parcela_id": first["parcela_id"],
        "municipio": first["municipio"],
        "superficie_ha": _num(first["superficie_ha"]),
        "lat": _num(first["lat"]),
        "lon": _num(first["lon"]),
        "rotacion_estimada": first["rotacion_estimada"],
        "precip_mm": _num(first["clima_lluvia_media_mm"]),
        "p20_precip_mm": _num(first["clima_lluvia_p20_mm"]),
        "heat_days": int(round(_num(first["clima_dias_calor_may_jun_media"], 0))),
        "frost_days": int(round(statistics.median(frost))) if frost else 0,
        "soil": {
            "arcilla_pct": _num(first["suelo_arcilla_pct"]),
            "limo_pct": _num(first["suelo_limo_pct"]),
            "arena_pct": _num(first["suelo_arena_pct"]),
            "ph_h2o": _num(first["suelo_ph_h2o"]),
            "cad_0_100_mm": _num(first["suelo_cad_0_100_mm"]),
            "cos_gkg": _num(first["suelo_cos_gkg"]),
        },
        "prices": prices,
        "price_reference": price_reference,
        "precio_fallback": any(
            ref["anio"] is not None and ref["anio"] != 2025
            for ref in price_reference.values()
        ),
        "campaigns": [
            {
                "campana": int(r["campana"]),
                "lluvia_mm": _num(r["lluvia_mm"]),
                "ndvi_jun_ago": _num(r["ndvi_jun_ago"]),
                "clase_estimada": r["clase_estimada"],
            }
            for r in sorted(rows, key=lambda r: int(r["campana"]))
        ],
    }


def _water_score(weighted_water: float, precip_mm: float) -> float:
    drought_factor = min(3.0, max(1.0, 450.0 / max(precip_mm, 1.0)))
    return max(0.0, min(100.0, 100.0 - (weighted_water / 5.0) * 80.0 * drought_factor))


def _soil_score(
    crops: dict, crop_ids: list[str], soil: dict | None
) -> tuple[float, dict]:
    avg_cover = sum(crops[c]["cover_months"] for c in crop_ids) / len(crop_ids)
    legume = any(crops[c]["nitrogen_fixer"] for c in crop_ids)

    if soil is None:
        cover_score = (avg_cover * 100.0) / 6.0
        score = min(100.0, cover_score + (15.0 if legume else 0.0))
        return score, {"modo": "sin_suelo"}

    cover_component = min(100.0, (avg_cover / 8.0) * 100.0)
    clay = soil.get("arcilla_pct") if soil.get("arcilla_pct") is not None else 30.0
    ph = soil.get("ph_h2o") if soil.get("ph_h2o") is not None else 7.0
    cad = soil.get("cad_0_100_mm") if soil.get("cad_0_100_mm") is not None else 120.0
    texture = max(0.0, min(100.0, 100.0 - abs(clay - 30.0) * 4.0))
    ph_score = max(0.0, min(100.0, 100.0 - abs(ph - 7.0) * 25.0))
    cad_score = max(0.0, min(100.0, ((cad - 100.0) / 50.0) * 100.0))
    quality = 0.4 * texture + 0.3 * ph_score + 0.3 * cad_score
    legume_component = 100.0 if legume else 0.0
    score = 0.5 * cover_component + 0.35 * quality + 0.15 * legume_component
    return max(0.0, min(100.0, score)), {
        "modo": "suelo_real",
        "cobertura": round(cover_component, 1),
        "calidad_suelo": round(quality, 1),
        "textura": round(texture, 1),
        "ph": round(ph_score, 1),
        "agua_disponible": round(cad_score, 1),
        "leguminosa": round(legume_component, 1),
    }


def calculate_scores(
    crops: dict,
    precip_mm: float,
    heat_days: int,
    prices: dict,
    frost_days: int = 0,
    soil: dict | None = None,
    dry_precip_mm: float | None = None,
) -> dict:
    """Motor de reglas puro. Devuelve las cuatro rotaciones con notas 0-100."""
    heat_ratio = max(0.0, min(1.0, 1.0 - (heat_days / 40.0)))
    frost_ratio = max(0.0, min(1.0, 1.0 - (frost_days / 20.0)))
    results = {}

    for rid, info in ROTATIONS.items():
        crop_ids = info["crops"]
        total_years = sum(crops[c]["years_weight"] for c in crop_ids)
        weighted_water = (
            sum(crops[c]["water_demand"] * crops[c]["years_weight"] for c in crop_ids)
            / total_years
        )
        water = _water_score(weighted_water, precip_mm)
        water_p20 = _water_score(
            weighted_water, dry_precip_mm if dry_precip_mm is not None else precip_mm
        )
        soil_score, soil_detail = _soil_score(crops, crop_ids, soil)

        market_avg = sum(crops[c]["market_ease"] for c in crop_ids) / len(crop_ids)
        price_values = [prices.get(c) for c in crop_ids]
        if all(v is not None for v in price_values):
            price_avg = sum(price_values) / len(price_values)
            profit = (
                0.7 * (market_avg / 5.0) * 100.0
                + 0.3 * (min(price_avg, 800.0) / 800.0) * 100.0
            )
        else:
            profit = None

        bare_soil_penalty = 25.0 if "barbecho" in crop_ids else 0.0
        diversity = min(100.0, max(40.0, 60.0 + 20.0 * (len(crop_ids) - 2)))
        risk = (
            (100.0 - bare_soil_penalty)
            * heat_ratio
            * frost_ratio
            * (0.7 + 0.3 * diversity / 100.0)
        )
        risk = max(0.0, min(100.0, risk))

        blockers = []
        warnings = []
        if water_p20 < 20.0:
            blockers.append("Déficit hídrico extremo incluso en año seco (P20)")
        elif water_p20 < 40.0:
            warnings.append("Estrés hídrico probable en años secos (P20)")
        if heat_days > 25:
            warnings.append("Calor elevado durante la temporada")
        if frost_days > 5:
            warnings.append("Riesgo de heladas por encima del umbral")
        if profit is None:
            warnings.append("Sin precio para todos los cultivos de la rotación")
        status = (
            "not_viable"
            if blockers
            else "viable_with_caveats"
            if warnings
            else "viable"
        )

        results[rid] = {
            "name": info["name"],
            "crops": crop_ids,
            "water": round(water, 1),
            "water_p20": round(water_p20, 1),
            "soil": round(soil_score, 1),
            "profit": round(profit, 1) if profit is not None else None,
            "profit_label": "precio/mercado (sin rendimiento ni costes)",
            "risk": round(risk, 1),
            "soil_detail": soil_detail,
            "viability": {
                "status": status,
                "blockers": blockers,
                "warnings": warnings,
            },
            "eligible": not blockers,
            "rankings": {},
            "confidence": "low",
            "confidence_score": 0.4,
            "data_gaps": [
                "Clima de celda NASA POWER (~50 km), no de la parcela",
                "Cultivo estimado por NDVI a 250 m; no hay cultivo declarado",
                "Sin rendimientos ni costes: la nota de precio no es margen",
            ],
        }
        results[rid]["normalized"] = {
            k: (
                round(results[rid][k] / 100.0, 3)
                if results[rid][k] is not None
                else None
            )
            for k in ("water", "soil", "profit", "risk")
        }

    for profile, weights in PROFILES.items():
        for rid, data in results.items():
            missing = [k for k in weights if data.get(k) is None]
            if profile == "profit_first" and "profit" in missing:
                data["rankings"][profile] = {
                    "rank": None,
                    "final_score": None,
                    "partial": True,
                    "missing": missing,
                    "contributions": {},
                }
                continue
            available = {k: w for k, w in weights.items() if data.get(k) is not None}
            total_w = sum(available.values())
            final = sum(data[k] * w for k, w in available.items()) / total_w
            data["rankings"][profile] = {
                "rank": None,
                "final_score": round(final, 1),
                "partial": bool(missing),
                "missing": missing,
                "contributions": {
                    k: round(data[k] * w / total_w, 1) for k, w in available.items()
                },
            }

        eligible = [
            rid
            for rid in results
            if results[rid]["eligible"]
            and results[rid]["rankings"][profile]["final_score"] is not None
        ]
        ranked = sorted(
            eligible,
            key=lambda rid: results[rid]["rankings"][profile]["final_score"],
            reverse=True,
        )
        for rank, rid in enumerate(ranked, start=1):
            results[rid]["rankings"][profile]["rank"] = rank

    return results


def score_farm(scenario: dict, crops: dict) -> dict:
    return calculate_scores(
        crops,
        scenario["precip_mm"],
        scenario["heat_days"],
        scenario["prices"],
        scenario["frost_days"],
        soil=scenario["soil"],
        dry_precip_mm=scenario["p20_precip_mm"],
    )


def build_indicators(
    scenarios_path: Path = SCENARIOS_PATH, crops_path: Path = CROPS_PATH
) -> dict:
    crops = load_crops(crops_path)
    rows = load_scenarios(scenarios_path)
    if not rows:
        raise ValueError(f"{scenarios_path} está vacío")

    groups: dict[str, list[dict]] = {}
    for row in rows:
        groups.setdefault(row["finca_key"], []).append(row)

    candidates = []
    for finca_key, group in sorted(groups.items()):
        scenario = planning_scenario(group)
        rotations = score_farm(scenario, crops)

        for rid, data in rotations.items():
            gaps = list(data["data_gaps"])
            if rid == "R1":
                gaps.append(
                    "Precio del garbanzo nacional; mercado más estrecho que trigo y girasol"
                )
            if rid == "R2":
                gaps.append(
                    "Sin precio Eurostat de veza; la nota de precio no se calcula"
                )
            if rid == "R3":
                gaps.append(
                    "El barbecho no genera ingreso; su nota de precio es 0 por definición"
                )
            if scenario["precio_fallback"]:
                gaps.append(
                    "Campaña 2025 sin precio Eurostat; se usa 2024 como referencia"
                )
            gaps.append(
                "La rotación observada es una estimación NDVI, no cultivo declarado"
            )
            data["data_gaps"] = list(dict.fromkeys(gaps))
            data["confidence"], data["confidence_score"] = CONFIDENCE[rid]

        candidates.append(
            {
                "finca_key": finca_key,
                "parcela_id": scenario["parcela_id"],
                "municipio": scenario["municipio"],
                "superficie_ha": scenario["superficie_ha"],
                "lat": scenario["lat"],
                "lon": scenario["lon"],
                "rotacion_estimada": scenario["rotacion_estimada"],
                "climate_used": {
                    "lluvia_media_mm": scenario["precip_mm"],
                    "lluvia_p20_mm": scenario["p20_precip_mm"],
                    "dias_calor_may_jun": scenario["heat_days"],
                    "dias_helada": scenario["frost_days"],
                },
                "price_reference": scenario["price_reference"],
                "campaigns": scenario["campaigns"],
                "rotations": rotations,
            }
        )

    top = {profile: Counter() for profile in PROFILES}
    for candidate in candidates:
        for rid, data in candidate["rotations"].items():
            for profile in PROFILES:
                if data["rankings"][profile]["rank"] == 1:
                    top[profile][rid] += 1

    return {
        "aoi": "antequera-malaga",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "status": "real_data_provisional",
        "source": "NASA POWER + SoilGrids + MODIS + Eurostat",
        "method": "reglas_explicables_v2",
        "profiles": PROFILES,
        "summary": {
            "fincas": len(candidates),
            "campanas": sorted({int(r["campana"]) for r in rows}),
            "top_por_perfil": {
                profile: dict(counts.most_common()) for profile, counts in top.items()
            },
        },
        "candidates": candidates,
    }


def main() -> None:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--scenarios", type=Path, default=SCENARIOS_PATH)
    ap.add_argument("--crops", type=Path, default=CROPS_PATH)
    ap.add_argument("--out", type=Path, default=OUT_PATH)
    args = ap.parse_args()

    data = build_indicators(args.scenarios, args.crops)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(f"{data['summary']['fincas']} fincas -> {args.out.relative_to(BASE_DIR)}")
    for profile, counts in data["summary"]["top_por_perfil"].items():
        print(f"  {profile}: {counts}")


if __name__ == "__main__":
    main()
