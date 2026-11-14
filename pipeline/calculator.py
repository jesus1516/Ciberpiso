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
CONTENT_PATH = BASE_DIR / "data" / "rotation_content.json"
SCENARIOS_PATH = BASE_DIR / "data" / "processed" / "scenarios.csv"
OUT_PATH = BASE_DIR / "data" / "processed" / "indicators.json"
CALIBRATION_PATH = BASE_DIR / "data" / "calibration.json"

DISCLAIMER = (
    "Herramienta de apoyo a la decisión. Ordena opciones y declara incertidumbre; "
    "no sustituye al agricultor, al agrónomo ni a una revisión local."
)

GLOSSARY = {
    "NDVI": "Índice de vegetación por satélite; alto = más biomasa verde.",
    "ET0": "Evapotranspiración de referencia: agua que perdería un cultivo de referencia.",
    "P20": "Año seco de referencia: el 20 % de las campañas tienen menos lluvia.",
    "deficit_hidrico": "Lluvia menos evapotranspiración; cuanto mayor, más estrés hídrico.",
    "balance_hidrico": "Diferencia entre la lluvia y la ET0 de una campaña.",
    "anomalia": "Diferencia de una campaña respecto a la media histórica.",
    "barbecho": "Año sin cultivo comercial para reservar agua y controlar malas hierbas.",
    "veza": "Leguminosa forrajera o de cubierta; no tiene serie de precio Eurostat.",
    "indice_0_100": "Nota relativa de la rotación; no es un porcentaje ni una probabilidad.",
}

SOURCES = [
    {
        "name": "NASA POWER",
        "url": "https://power.larc.nasa.gov/",
        "use": "Lluvia, temperatura, ET0 y déficit hídrico por celda.",
    },
    {
        "name": "MODIS MOD13Q1",
        "url": "https://planetarycomputer.microsoft.com/dataset/modis-13Q1-061",
        "use": "NDVI y clase de cultivo estimada por campaña.",
    },
    {
        "name": "SoilGrids 2.0",
        "url": "https://soilgrids.org/",
        "use": "Textura, pH, carbono y agua disponible del suelo.",
    },
    {
        "name": "Eurostat apri_ap_crpouta",
        "url": "https://ec.europa.eu/eurostat/databrowser/view/apri_ap_crpouta/default/table",
        "use": "Precio medio anual de venta en España.",
    },
    {
        "name": "MAPA Anuario de Estadística 2025, tabla 7.2.7.2",
        "url": "https://www.mapa.gob.es/estadistica/pags/anuario/2025/FORMATO%20PDF/AE25-C07/7.2.7.2.pdf",
        "use": "Precio medio anual de veza grano en España (2014-2024).",
    },
]

DEFAULT_CALIBRATION = {
    "version": 1,
    "water_model": "deficit",
    "water_reference_deficit_mm": 900.0,
    "nota": "Déficit hídrico anual (lluvia - ET0); calibrado en docs/validacion.md",
}

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

PRIORITY_KEYS = {"water", "soil", "profit", "risk"}


def normalizar_pesos(weights: dict) -> dict:
    """Valida y normaliza pesos de prioridad; deben sumar 1."""
    limpios = {}
    for key, value in weights.items():
        if key not in PRIORITY_KEYS:
            raise ValueError(f"Prioridad desconocida: {key}")
        valor = float(value)
        if valor < 0:
            raise ValueError(f"Peso negativo en {key}")
        limpios[key] = valor
    total = sum(limpios.values())
    if total <= 0:
        raise ValueError("Los pesos deben sumar más de 0")
    return {k: v / total for k, v in limpios.items()}


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
            "erosion_protection": float(row.get("erosion_protection_1_5") or 3),
            "organic_matter": float(row.get("organic_matter_1_5") or 3),
            "drought_tolerance": float(row.get("drought_tolerance_1_5") or 3),
            "input_cost": float(row.get("input_cost_1_5") or 3),
            "years_weight": float(row["rotation_years"]),
            "risk": row["main_risk"],
        }
    return crops


def load_scenarios(path: Path = SCENARIOS_PATH) -> list[dict]:
    return leer_csv(path)


def load_calibration(path: Path = CALIBRATION_PATH) -> dict:
    """Carga los parámetros calibrados; si no existen, usa los valores por defecto."""
    calibracion = dict(DEFAULT_CALIBRATION)
    if path.exists():
        calibracion.update(json.loads(path.read_text(encoding="utf-8")))
    return calibracion


def load_content(path: Path = CONTENT_PATH) -> dict:
    """Carga las fichas explicativas de cada rotación."""
    if not path.exists():
        raise FileNotFoundError(f"No existe {path}")
    return json.loads(path.read_text(encoding="utf-8"))


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

    precip = _num(first["clima_lluvia_media_mm"])
    precip_p20 = _num(first["clima_lluvia_p20_mm"])
    deficit = _num(first["clima_deficit_medio_mm"])
    deficit_p20 = (
        deficit + (precip - precip_p20)
        if None not in (deficit, precip, precip_p20)
        else None
    )

    return {
        "finca_key": first["finca_key"],
        "parcela_id": first["parcela_id"],
        "municipio": first["municipio"],
        "superficie_ha": _num(first["superficie_ha"]),
        "lat": _num(first["lat"]),
        "lon": _num(first["lon"]),
        "rotacion_estimada": first["rotacion_estimada"],
        "precip_mm": precip,
        "p20_precip_mm": precip_p20,
        "deficit_mm": deficit,
        "deficit_p20_mm": deficit_p20,
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


def _water_score(
    weighted_water: float,
    precip_mm: float,
    deficit_mm: float | None = None,
    reference_deficit_mm: float = 900.0,
) -> float:
    """Nota de agua. Con déficit usa P-ET0; sin él, conserva el modo lluvia antiguo."""
    if deficit_mm is not None:
        drought_factor = min(
            3.0, max(0.25, deficit_mm / max(reference_deficit_mm, 1.0))
        )
    else:
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
    protection = (
        sum(crops[c].get("erosion_protection", 3.0) for c in crop_ids)
        / len(crop_ids)
        / 5.0
        * 100.0
    )
    organic = (
        sum(crops[c].get("organic_matter", 3.0) for c in crop_ids)
        / len(crop_ids)
        / 5.0
        * 100.0
    )
    score = (
        0.40 * cover_component
        + 0.25 * quality
        + 0.15 * protection
        + 0.10 * organic
        + 0.10 * legume_component
    )
    return max(0.0, min(100.0, score)), {
        "modo": "suelo_real",
        "cobertura": round(cover_component, 1),
        "calidad_suelo": round(quality, 1),
        "textura": round(texture, 1),
        "ph": round(ph_score, 1),
        "agua_disponible": round(cad_score, 1),
        "proteccion_erosion": round(protection, 1),
        "materia_organica": round(organic, 1),
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
    deficit_mm: float | None = None,
    dry_deficit_mm: float | None = None,
    calibration: dict | None = None,
    custom_weights: dict | None = None,
    constraints: dict | None = None,
) -> dict:
    """Motor de reglas puro. Devuelve las cuatro rotaciones con notas 0-100."""
    calibracion = calibration or DEFAULT_CALIBRATION
    reference_deficit = float(calibracion.get("water_reference_deficit_mm", 900.0))
    use_deficit = calibracion.get("water_model", "deficit") == "deficit"
    profiles = dict(PROFILES)
    if custom_weights:
        profiles["custom"] = normalizar_pesos(custom_weights)
    constraints = constraints or {}
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
        water = _water_score(
            weighted_water,
            precip_mm,
            deficit_mm if use_deficit else None,
            reference_deficit,
        )
        dry_deficit = (
            (dry_deficit_mm if dry_deficit_mm is not None else deficit_mm)
            if use_deficit
            else None
        )
        water_p20 = _water_score(
            weighted_water,
            dry_precip_mm if dry_precip_mm is not None else precip_mm,
            dry_deficit,
            reference_deficit,
        )
        soil_score, soil_detail = _soil_score(crops, crop_ids, soil)

        market_avg = sum(crops[c]["market_ease"] for c in crop_ids) / len(crop_ids)
        price_values = [prices.get(c) for c in crop_ids]
        if all(v is not None for v in price_values):
            price_avg = sum(price_values) / len(price_values)
            market_component = 0.7 * (market_avg / 5.0) * 100.0
            price_component = 0.3 * (min(price_avg, 800.0) / 800.0) * 100.0
            profit = market_component + price_component
        else:
            price_avg = None
            market_component = None
            price_component = None
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
        max_water = constraints.get("max_water_demand")
        if max_water is not None and weighted_water > float(max_water):
            blockers.append(
                f"Demanda media de agua {weighted_water:.1f}/5 supera el límite {max_water}"
            )
        if constraints.get("market_safe") and any(
            crops[c]["market_ease"] < 3 for c in crop_ids
        ):
            blockers.append("Algún cultivo tiene un mercado demasiado estrecho")
        max_crops = constraints.get("max_crops")
        if max_crops is not None and len(crop_ids) > int(max_crops):
            blockers.append(
                f"La rotación tiene {len(crop_ids)} cultivos; el manejo admite {max_crops}"
            )
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
            "market": {
                "score": round(profit, 1) if profit is not None else None,
                "price_eur_t": round(price_avg, 1) if price_avg is not None else None,
                "market_ease_1_5": round(market_avg, 1),
                "component_market_ease": round(market_component, 1)
                if market_component is not None
                else None,
                "component_price": round(price_component, 1)
                if price_component is not None
                else None,
                "is_profit": False,
                "price_source": "Eurostat apri_ap_crpouta",
                "price_year": 2024,
                "gap": "Sin rendimiento ni costes: es un proxy de precio/mercado",
            },
            "comparable": profit is not None,
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

    for profile, weights in profiles.items():
        for rid, data in results.items():
            missing = [k for k in weights if data.get(k) is None]
            available = {k: w for k, w in weights.items() if data.get(k) is not None}
            total_w = sum(available.values())
            partial_score = (
                sum(data[k] * w for k, w in available.items()) / total_w
                if total_w
                else None
            )
            if missing:
                data["rankings"][profile] = {
                    "rank": None,
                    "final_score": None,
                    "partial": True,
                    "partial_score": round(partial_score, 1)
                    if partial_score is not None
                    else None,
                    "missing": missing,
                    "contributions": {
                        k: round(data[k] * w / total_w, 1) for k, w in available.items()
                    },
                    "tied_with": [],
                }
                continue
            final = sum(data[k] * w for k, w in available.items()) / total_w
            data["rankings"][profile] = {
                "rank": None,
                "final_score": round(final, 1),
                "partial": False,
                "partial_score": None,
                "missing": [],
                "contributions": {
                    k: round(data[k] * w / total_w, 1) for k, w in available.items()
                },
                "tied_with": [],
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
        last_score = None
        last_rank = 0
        for position, rid in enumerate(ranked, start=1):
            score = results[rid]["rankings"][profile]["final_score"]
            if score == last_score:
                rank = last_rank
            else:
                rank = position
                last_rank = position
                last_score = score
            results[rid]["rankings"][profile]["rank"] = rank

        por_puesto: dict[int, list[str]] = {}
        for rid in ranked:
            rank = results[rid]["rankings"][profile]["rank"]
            por_puesto.setdefault(rank, []).append(rid)
        for rid in ranked:
            rank = results[rid]["rankings"][profile]["rank"]
            results[rid]["rankings"][profile]["tied_with"] = [
                other for other in por_puesto[rank] if other != rid
            ]

    return results


def score_farm(
    scenario: dict,
    crops: dict,
    calibration: dict | None = None,
    custom_weights: dict | None = None,
    constraints: dict | None = None,
) -> dict:
    return calculate_scores(
        crops,
        scenario["precip_mm"],
        scenario["heat_days"],
        scenario["prices"],
        scenario["frost_days"],
        soil=scenario["soil"],
        dry_precip_mm=scenario["p20_precip_mm"],
        deficit_mm=scenario.get("deficit_mm"),
        dry_deficit_mm=scenario.get("deficit_p20_mm"),
        calibration=calibration,
        custom_weights=custom_weights,
        constraints=constraints,
    )


def _dynamic_evidence(
    rid: str, scenario: dict, data: dict, r0_water: float | None
) -> list[dict]:
    campañas = scenario["campaigns"]
    ndvi = [c["ndvi_jun_ago"] for c in campañas if c["ndvi_jun_ago"] is not None]
    ndvi_media = sum(ndvi) / len(ndvi) if ndvi else None
    arable = [
        c["clase_estimada"] in ("herbaceo_invierno", "herbaceo_verano")
        for c in campañas
    ]
    arable_share = sum(arable) / len(arable) if arable else None

    evidencia = [
        {
            "source": "NASA POWER",
            "url": "https://power.larc.nasa.gov/",
            "date": "2002-2025",
            "value": (
                f"Lluvia media {scenario['precip_mm']:.0f} mm; "
                f"P20 {scenario['p20_precip_mm']:.0f} mm; "
                f"déficit {scenario['deficit_mm']:.0f} mm"
            ),
        },
        {
            "source": "MODIS MOD13Q1",
            "url": "https://planetarycomputer.microsoft.com/dataset/modis-13Q1-061",
            "date": "2020-2025",
            "value": (
                f"NDVI jun-ago medio {ndvi_media:.2f}; "
                f"{arable_share:.0%} de campañas arables"
            )
            if ndvi_media is not None and arable_share is not None
            else "Serie NDVI incompleta",
        },
        {
            "source": "SoilGrids 2.0",
            "url": "https://soilgrids.org/",
            "date": "2026-11-14",
            "value": (
                f"Arcilla {scenario['soil']['arcilla_pct']:.0f}%; "
                f"pH {scenario['soil']['ph_h2o']:.1f}; "
                f"agua disponible {scenario['soil']['cad_0_100_mm']:.0f} mm"
            ),
        },
    ]

    ref = scenario["price_reference"]
    if rid == "R0":
        evidencia.append(
            {
                "source": "Eurostat apri_ap_crpouta",
                "url": "https://ec.europa.eu/eurostat/databrowser/view/apri_ap_crpouta/default/table",
                "date": "2024",
                "value": (
                    f"Trigo {ref['trigo']['eur_t']:.0f} €/t; "
                    f"girasol {ref['girasol']['eur_t']:.0f} €/t"
                ),
            }
        )
    elif rid == "R1":
        evidencia.append(
            {
                "source": "Eurostat apri_ap_crpouta",
                "url": "https://ec.europa.eu/eurostat/databrowser/view/apri_ap_crpouta/default/table",
                "date": "2024",
                "value": f"Garbanzo {ref['garbanzo']['eur_t']:.0f} €/t",
            }
        )
    elif rid == "R2":
        evidencia.append(
            {
                "source": "MAPA Anuario de Estadística 2025, tabla 7.2.7.2",
                "url": "https://www.mapa.gob.es/estadistica/pags/anuario/2025/FORMATO%20PDF/AE25-C07/7.2.7.2.pdf",
                "date": str(ref["veza"]["anio"] or 2024),
                "value": (
                    f"Veza grano {ref['veza']['eur_t']:.0f} €/t; "
                    "precio nacional percibido por el agricultor"
                )
                if ref["veza"]["eur_t"] is not None
                else "Precio de veza no disponible",
            }
        )
    else:
        evidencia.append(
            {
                "source": "Cálculo interno",
                "date": "2026-11-14",
                "value": (
                    f"Nota de agua R3 {data['water']:.1f} frente a R0 {r0_water:.1f}"
                    if r0_water is not None
                    else "Barbecho sin ingreso; reserva de agua no medida en campo"
                ),
            }
        )
    return evidencia


def _indicator_metadata(rid: str, data: dict, scenario: dict) -> dict:
    deficit = scenario.get("deficit_mm")
    return {
        "water": {
            "value": data["water"],
            "unit": "índice 0-100",
            "source": "NASA POWER",
            "date": "2002-2025",
            "confidence": "medium",
            "gap": f"Déficit medio {deficit:.0f} mm; celda de ~50 km"
            if deficit
            else "Celda de ~50 km",
            "p20": data["water_p20"],
        },
        "soil": {
            "value": data["soil"],
            "unit": "índice 0-100",
            "source": "SoilGrids 2.0 + MODIS",
            "date": "2026-11-14",
            "confidence": "medium",
            "gap": "Sin análisis de laboratorio ni materia orgánica medida",
        },
        "profit": {
            "value": data["profit"],
            "unit": "índice 0-100 (proxy precio/mercado)",
            "source": data["market"].get("price_source", "Eurostat apri_ap_crpouta"),
            "date": str(data["market"].get("price_year") or 2024),
            "confidence": "low",
            "gap": data["market"]["gap"]
            if data["profit"] is not None
            else "Sin precio de veza; no se calcula",
            "price_eur_t": data["market"]["price_eur_t"],
            "market_ease_1_5": data["market"]["market_ease_1_5"],
        },
        "risk": {
            "value": data["risk"],
            "unit": "índice 0-100",
            "source": "NASA POWER",
            "date": "2002-2025",
            "confidence": "low",
            "gap": "Umbrales expertos; no validados con daños observados",
        },
    }


def _confidence_for(data: dict) -> tuple[str, float, dict]:
    precio = 0.0
    if data["profit"] is not None:
        precio = 0.8 if "MAPA" in data["market"].get("price_source", "") else 1.0
    componentes = {
        "clima": 1.0,
        "suelo": 1.0,
        "precio": precio,
        "validacion": 0.7,
    }
    cobertura = sum(componentes.values()) / len(componentes)
    score = round(cobertura * 0.8, 2)
    level = "high" if score >= 0.8 else "medium" if score >= 0.6 else "low"
    return (
        level,
        score,
        {
            "cobertura": round(cobertura, 2),
            "evidencia": 0.8,
            "componentes": componentes,
        },
    )


def build_indicators(
    scenarios_path: Path = SCENARIOS_PATH,
    crops_path: Path = CROPS_PATH,
    calibration_path: Path = CALIBRATION_PATH,
    content_path: Path = CONTENT_PATH,
    custom_weights: dict | None = None,
    constraints: dict | None = None,
) -> dict:
    crops = load_crops(crops_path)
    calibration = load_calibration(calibration_path)
    content = load_content(content_path)
    profiles = dict(PROFILES)
    if custom_weights:
        profiles["custom"] = normalizar_pesos(custom_weights)
    rows = load_scenarios(scenarios_path)
    if not rows:
        raise ValueError(f"{scenarios_path} está vacío")

    groups: dict[str, list[dict]] = {}
    for row in rows:
        groups.setdefault(row["finca_key"], []).append(row)

    candidates = []
    for finca_key, group in sorted(groups.items()):
        scenario = planning_scenario(group)
        rotations = score_farm(
            scenario, crops, calibration, custom_weights, constraints
        )

        r0_water = rotations["R0"]["water"]
        for rid, data in rotations.items():
            ficha = content.get(
                rid,
                {
                    "why": "",
                    "benefits": [],
                    "data_gaps": [],
                    "review_risks": [],
                    "evidence": [],
                },
            )
            gaps = list(data["data_gaps"]) + list(ficha.get("data_gaps", []))
            if rid == "R1":
                gaps.append(
                    "Precio del garbanzo nacional; mercado más estrecho que trigo y girasol"
                )
            if rid == "R2":
                gaps.append(
                    "Precio de veza del MAPA (nacional y anual); no hay lonja local"
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
                "La nota de agua usa déficit hídrico (lluvia - ET0), no solo lluvia"
            )
            gaps.append(
                "La rotación observada es una estimación NDVI, no cultivo declarado"
            )
            data["market"]["price_year"] = scenario["price_reference"]["trigo"]["anio"]
            if rid == "R2":
                data["market"]["price_source"] = (
                    "Eurostat (trigo/girasol) + MAPA (veza)"
                )
            data["why"] = ficha.get("why", "")
            data["benefits"] = ficha.get("benefits", [])
            data["review_risks"] = ficha.get("review_risks", [])
            data["data_gaps"] = list(dict.fromkeys(gaps))
            data["evidence"] = list(ficha.get("evidence", [])) + _dynamic_evidence(
                rid, scenario, data, r0_water
            )
            data["indicators"] = _indicator_metadata(rid, data, scenario)
            (
                data["confidence"],
                data["confidence_score"],
                data["confidence_detail"],
            ) = _confidence_for(data)
            data["disclaimer"] = DISCLAIMER

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
                    "deficit_medio_mm": scenario["deficit_mm"],
                    "deficit_p20_mm": scenario["deficit_p20_mm"],
                    "dias_calor_may_jun": scenario["heat_days"],
                    "dias_helada": scenario["frost_days"],
                },
                "price_reference": scenario["price_reference"],
                "campaigns": scenario["campaigns"],
                "rotations": rotations,
            }
        )

    top = {profile: Counter() for profile in profiles}
    for candidate in candidates:
        for rid, data in candidate["rotations"].items():
            for profile in profiles:
                if data["rankings"][profile]["rank"] == 1:
                    top[profile][rid] += 1

    return {
        "aoi": "antequera-malaga",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "status": "real_data_provisional",
        "source": "NASA POWER + SoilGrids + MODIS + Eurostat",
        "method": "reglas_explicables_v2",
        "disclaimer": DISCLAIMER,
        "glossary": GLOSSARY,
        "sources": SOURCES,
        "calibration": calibration,
        "profiles": profiles,
        "custom_weights": custom_weights,
        "constraints": constraints or {},
        "summary": {
            "fincas": len(candidates),
            "campanas": sorted({int(r["campana"]) for r in rows}),
            "top_por_perfil": {
                profile: dict(counts.most_common()) for profile, counts in top.items()
            },
        },
        "candidates": candidates,
    }


def _json_arg(value: str | None) -> dict | None:
    if not value:
        return None
    path = Path(value)
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return json.loads(value)


def main() -> None:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--scenarios", type=Path, default=SCENARIOS_PATH)
    ap.add_argument("--crops", type=Path, default=CROPS_PATH)
    ap.add_argument("--calibration", type=Path, default=CALIBRATION_PATH)
    ap.add_argument("--out", type=Path, default=OUT_PATH)
    ap.add_argument(
        "--weights",
        help='Pesos personalizados, JSON o ruta. Ej: {"water":0.5,"soil":0.3,"profit":0.1,"risk":0.1}',
    )
    ap.add_argument(
        "--constraints",
        help='Restricciones, JSON o ruta. Ej: {"max_water_demand":2.5,"market_safe":true,"max_crops":2}',
    )
    args = ap.parse_args()

    data = build_indicators(
        args.scenarios,
        args.crops,
        args.calibration,
        custom_weights=_json_arg(args.weights),
        constraints=_json_arg(args.constraints),
    )
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(f"{data['summary']['fincas']} fincas -> {args.out.relative_to(BASE_DIR)}")
    for profile, counts in data["summary"]["top_por_perfil"].items():
        print(f"  {profile}: {counts}")


if __name__ == "__main__":
    main()
