#!/usr/bin/env python3
"""Validate the calculator's water score and decide whether to calibrate it.

Compares the old model (rain only) with the water deficit model
(rain - ET0) using the 360 farm-seasons. The main label is
`exito_estival` (Jun-Aug NDVI >= 0.33), the only one with enough signal.
`clase_arable` is reported as a negative control: it does not discriminate.

Writes:
    data/calibration.json             adopted parameters (versioned)
    data/processed/validation.json    metrics, folds and decision (intermediate)

Usage:
    python3 pipeline/calibrate.py
"""

from __future__ import annotations

import argparse
import json
import math
import statistics
import sys
from datetime import datetime, timezone
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from pipeline.calculator import (  # noqa: E402
    CALIBRATION_PATH,
    CROPS_PATH,
    DEFAULT_CALIBRATION,
    SCENARIOS_PATH,
    calculate_scores,
    load_crops,
    load_scenarios,
)

VALIDATION_PATH = BASE_DIR / "data" / "processed" / "validation.json"
PRICE_COLS = {
    "trigo": "precio_trigo_eur_t",
    "girasol": "precio_girasol_eur_t",
    "garbanzo": "precio_garbanzo_eur_t",
    "veza": "precio_veza_eur_t",
}
LABELS = {
    "exito_estival": "NDVI jun-ago >= 0,33",
    "clase_arable": "clase herbácea invierno/verano",
}
REFERENCE_DEFICIT_MM = 900.0
MIN_MEJORA_AUC = 0.05
MIN_MEJORA_SPEARMAN = 0.05
MIN_MEJORA_LOMO = 0.03


def _num(value) -> float | None:
    if value is None or value == "":
        return None
    return float(value)


def _scenario(row: dict, crops: dict) -> dict:
    prices = {crop: _num(row.get(col)) for crop, col in PRICE_COLS.items()}
    prices["barbecho"] = 0.0
    return {
        "precip_mm": _num(row["lluvia_mm"]),
        "p20_precip_mm": _num(row["clima_lluvia_p20_mm"]),
        "deficit_mm": _num(row["deficit_mm"]),
        "deficit_p20_mm": _num(row["deficit_mm"])
        + (_num(row["lluvia_mm"]) - _num(row["clima_lluvia_p20_mm"])),
        "heat_days": int(round(_num(row["dias_calor_may_jun"]))),
        "frost_days": int(round(_num(row["dias_helada"]))),
        "soil": {
            "arcilla_pct": _num(row["suelo_arcilla_pct"]),
            "limo_pct": _num(row["suelo_limo_pct"]),
            "arena_pct": _num(row["suelo_arena_pct"]),
            "ph_h2o": _num(row["suelo_ph_h2o"]),
            "cad_0_100_mm": _num(row["suelo_cad_0_100_mm"]),
            "cos_gkg": _num(row["suelo_cos_gkg"]),
        },
        "prices": prices,
    }


def water_score(row: dict, crops: dict, model: str) -> float:
    """Water score of the current rotation (R0) with the requested model."""
    scenario = _scenario(row, crops)
    deficit = scenario["deficit_mm"] if model == "deficit" else None
    deficit_p20 = scenario["deficit_p20_mm"] if model == "deficit" else None
    results = calculate_scores(
        crops,
        scenario["precip_mm"],
        scenario["heat_days"],
        scenario["prices"],
        scenario["frost_days"],
        soil=scenario["soil"],
        dry_precip_mm=scenario["p20_precip_mm"],
        deficit_mm=deficit,
        dry_deficit_mm=deficit_p20,
    )
    return results["R0"]["water"]


def auc(labels: list[int], scores: list[float]) -> float | None:
    positivos = [s for s, y in zip(scores, labels) if y == 1]
    negativos = [s for s, y in zip(scores, labels) if y == 0]
    if not positivos or not negativos:
        return None
    victorias = sum(1 for a in positivos for b in negativos if a > b) + 0.5 * sum(
        1 for a in positivos for b in negativos if a == b
    )
    return victorias / (len(positivos) * len(negativos))


def _rangos(values: list[float]) -> list[float]:
    orden = sorted(range(len(values)), key=lambda i: values[i])
    rangos = [0.0] * len(values)
    i = 0
    while i < len(values):
        j = i
        while j + 1 < len(values) and values[orden[j + 1]] == values[orden[i]]:
            j += 1
        rango = (i + j) / 2.0 + 1.0
        for k in range(i, j + 1):
            rangos[orden[k]] = rango
        i = j + 1
    return rangos


def spearman(x: list[float], y: list[float]) -> float | None:
    if len(x) < 3 or len(x) != len(y):
        return None
    rx, ry = _rangos(x), _rangos(y)
    n = len(x)
    mx, my = sum(rx) / n, sum(ry) / n
    num = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    den = math.sqrt(sum((a - mx) ** 2 for a in rx) * sum((b - my) ** 2 for b in ry))
    return num / den if den else None


def best_threshold(labels: list[int], scores: list[float]) -> dict:
    """Umbral que maximiza balanced accuracy (Youden J)."""
    mejor = None
    for threshold in sorted(set(scores)):
        tp = sum(1 for s, y in zip(scores, labels) if s >= threshold and y == 1)
        fp = sum(1 for s, y in zip(scores, labels) if s >= threshold and y == 0)
        fn = sum(1 for s, y in zip(scores, labels) if s < threshold and y == 1)
        tn = sum(1 for s, y in zip(scores, labels) if s < threshold and y == 0)
        sensibilidad = tp / (tp + fn) if tp + fn else 0.0
        especificidad = tn / (tn + fp) if tn + fp else 0.0
        balanced = (sensibilidad + especificidad) / 2.0
        candidato = {
            "threshold": round(threshold, 2),
            "balanced_accuracy": round(balanced, 3),
            "sensitivity": round(sensibilidad, 3),
            "specificity": round(especificidad, 3),
            "confusion": {"tp": tp, "fp": fp, "tn": tn, "fn": fn},
        }
        if mejor is None or balanced > mejor["balanced_accuracy"]:
            mejor = candidato
    return mejor


def evaluar(rows: list[dict], crops: dict, model: str, label: str) -> dict:
    scores = [water_score(r, crops, model) for r in rows]
    labels = [int(r[label]) for r in rows]
    ndvi_jun = [_num(r["ndvi_jun_ago"]) for r in rows]
    ndvi_max = [_num(r["ndvi_max"]) for r in rows]
    return {
        "filas": len(rows),
        "positivos": sum(labels),
        "auc": round(auc(labels, scores), 3) if auc(labels, scores) else None,
        "spearman_ndvi_jun_ago": (
            round(spearman(scores, ndvi_jun), 3) if spearman(scores, ndvi_jun) else None
        ),
        "spearman_ndvi_max": (
            round(spearman(scores, ndvi_max), 3) if spearman(scores, ndvi_max) else None
        ),
        "mejor_umbral": best_threshold(labels, scores),
        "scores": scores,
    }


def por_grupo(
    rows: list[dict], crops: dict, model: str, label: str, campo: str
) -> dict:
    salida = {}
    for valor in sorted({r[campo] for r in rows}, key=str):
        sub = [r for r in rows if r[campo] == valor]
        if not sub:
            continue
        labels = [int(r[label]) for r in sub]
        scores = [water_score(r, crops, model) for r in sub]
        salida[str(valor)] = {
            "filas": len(sub),
            "positivos": sum(labels),
            "auc": round(auc(labels, scores), 3) if auc(labels, scores) else None,
        }
    return salida


def lomo(rows: list[dict], crops: dict, model: str, label: str) -> dict:
    """Leave one municipality out: threshold on train, balanced accuracy on test."""
    folds = []
    for municipio in sorted({r["municipio"] for r in rows}):
        train = [r for r in rows if r["municipio"] != municipio]
        test = [r for r in rows if r["municipio"] == municipio]
        train_labels = [int(r[label]) for r in train]
        test_labels = [int(r[label]) for r in test]
        if len(set(train_labels)) < 2 or len(set(test_labels)) < 2:
            folds.append(
                {
                    "municipio": municipio,
                    "filas_test": len(test),
                    "positivos_test": sum(test_labels),
                    "auc": None,
                    "balanced_accuracy": None,
                    "motivo": "una sola clase en train o test",
                }
            )
            continue
        train_scores = [water_score(r, crops, model) for r in train]
        test_scores = [water_score(r, crops, model) for r in test]
        umbral = best_threshold(train_labels, train_scores)["threshold"]
        tp = sum(1 for s, y in zip(test_scores, test_labels) if s >= umbral and y == 1)
        fp = sum(1 for s, y in zip(test_scores, test_labels) if s >= umbral and y == 0)
        fn = sum(1 for s, y in zip(test_scores, test_labels) if s < umbral and y == 1)
        tn = sum(1 for s, y in zip(test_scores, test_labels) if s < umbral and y == 0)
        sens = tp / (tp + fn) if tp + fn else 0.0
        esp = tn / (tn + fp) if tn + fp else 0.0
        folds.append(
            {
                "municipio": municipio,
                "filas_test": len(test),
                "positivos_test": sum(test_labels),
                "auc": round(auc(test_labels, test_scores), 3),
                "balanced_accuracy": round((sens + esp) / 2.0, 3),
                "umbral_train": umbral,
            }
        )

    con_auc = [f for f in folds if f["auc"] is not None]
    con_ba = [f for f in folds if f["balanced_accuracy"] is not None]
    return {
        "auc_ponderada": (
            round(
                sum(f["auc"] * f["filas_test"] for f in con_auc)
                / sum(f["filas_test"] for f in con_auc),
                3,
            )
            if con_auc
            else None
        ),
        "balanced_accuracy_ponderada": (
            round(
                sum(f["balanced_accuracy"] * f["filas_test"] for f in con_ba)
                / sum(f["filas_test"] for f in con_ba),
                3,
            )
            if con_ba
            else None
        ),
        "folds": folds,
    }


def construir_validacion(
    scenarios_path: Path = SCENARIOS_PATH, crops_path: Path = CROPS_PATH
) -> tuple[dict, dict]:
    rows = load_scenarios(scenarios_path)
    crops = load_crops(crops_path)
    if not rows:
        raise ValueError(f"{scenarios_path} is empty")

    modelos = {}
    lomos = {}
    grupos = {}
    for model in ("precip", "deficit"):
        modelos[model] = {label: evaluar(rows, crops, model, label) for label in LABELS}
        lomos[model] = {label: lomo(rows, crops, model, label) for label in LABELS}
        grupos[model] = {
            label: {
                "campana": por_grupo(rows, crops, model, label, "campana"),
                "municipio": por_grupo(rows, crops, model, label, "municipio"),
            }
            for label in LABELS
        }

    # Drop the individual scores from the JSON: only the metrics matter.
    for model in modelos:
        for label in LABELS:
            modelos[model][label].pop("scores", None)

    baseline = modelos["precip"]["exito_estival"]
    candidato = modelos["deficit"]["exito_estival"]
    lomo_base = lomos["precip"]["exito_estival"]["auc_ponderada"]
    lomo_cand = lomos["deficit"]["exito_estival"]["auc_ponderada"]
    mejora_auc = (candidato["auc"] or 0) - (baseline["auc"] or 0)
    mejora_rho = (candidato["spearman_ndvi_jun_ago"] or 0) - (
        baseline["spearman_ndvi_jun_ago"] or 0
    )
    mejora_lomo = (lomo_cand or 0) - (lomo_base or 0)
    adoptar = (
        mejora_auc >= MIN_MEJORA_AUC
        and mejora_rho >= MIN_MEJORA_SPEARMAN
        and mejora_lomo >= MIN_MEJORA_LOMO
    )

    decision = {
        "modelo_adoptado": "deficit" if adoptar else "precip",
        "motivo": (
            "El deficit hidrico mejora AUC, Spearman y validacion por municipio"
            if adoptar
            else "La mejora no supera los umbrales; se mantiene el modelo de lluvia"
        ),
        "mejora_auc": round(mejora_auc, 3),
        "mejora_spearman_ndvi_jun_ago": round(mejora_rho, 3),
        "mejora_lomo_auc": round(mejora_lomo, 3),
        "umbrales": {
            "auc": MIN_MEJORA_AUC,
            "spearman": MIN_MEJORA_SPEARMAN,
            "lomo": MIN_MEJORA_LOMO,
        },
        "etiqueta_principal": "exito_estival",
        "clase_arable": "control negativo: sin senal suficiente",
        "umbrales_viabilidad": {
            "blocker": 20,
            "warning": 40,
            "nota": "No se recalibran: la nota no es una probabilidad y el umbral optimo no es estable",
        },
    }

    validacion = {
        "generado": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "dataset": {
            "filas": len(rows),
            "fincas": len({r["finca_key"] for r in rows}),
            "campanas": sorted({int(r["campana"]) for r in rows}),
            "municipios": len({r["municipio"] for r in rows}),
        },
        "etiquetas": LABELS,
        "modelos": modelos,
        "por_campana_y_municipio": grupos,
        "leave_one_municipality_out": lomos,
        "decision": decision,
    }

    calibracion = {
        "version": 1,
        "water_model": "deficit" if adoptar else "precip",
        "water_reference_deficit_mm": REFERENCE_DEFICIT_MM if adoptar else None,
        "nota": (
            "Déficit hídrico anual (lluvia - ET0) validado en docs/validacion.md; "
            "la referencia de 900 mm solo fija la escala, no se ajusta a la etiqueta"
        ),
        "validacion": {
            "auc_exito_estival_precip": baseline["auc"],
            "auc_exito_estival_deficit": candidato["auc"],
            "spearman_ndvi_jun_ago_precip": baseline["spearman_ndvi_jun_ago"],
            "spearman_ndvi_jun_ago_deficit": candidato["spearman_ndvi_jun_ago"],
            "lomo_auc_precip": lomo_base,
            "lomo_auc_deficit": lomo_cand,
        },
    }
    return validacion, calibracion


def main() -> None:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--scenarios", type=Path, default=SCENARIOS_PATH)
    ap.add_argument("--crops", type=Path, default=CROPS_PATH)
    ap.add_argument("--calibration", type=Path, default=CALIBRATION_PATH)
    ap.add_argument("--validation", type=Path, default=VALIDATION_PATH)
    args = ap.parse_args()

    validacion, calibracion = construir_validacion(args.scenarios, args.crops)
    args.validation.parent.mkdir(parents=True, exist_ok=True)
    args.validation.write_text(
        json.dumps(validacion, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    args.calibration.write_text(
        json.dumps(calibracion, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    base = validacion["modelos"]["precip"]["exito_estival"]
    cand = validacion["modelos"]["deficit"]["exito_estival"]
    print(
        f"Summer success (n={base['positivos']}/{base['filas']}): "
        f"AUC {base['auc']} -> {cand['auc']}; "
        f"Spearman NDVI Jun {base['spearman_ndvi_jun_ago']} -> {cand['spearman_ndvi_jun_ago']}"
    )
    print(
        f"LOMO AUC: {validacion['leave_one_municipality_out']['precip']['exito_estival']['auc_ponderada']} "
        f"-> {validacion['leave_one_municipality_out']['deficit']['exito_estival']['auc_ponderada']}"
    )
    print(f"Decision: {validacion['decision']['modelo_adoptado']}")
    print(f"-> {args.calibration.relative_to(BASE_DIR)}")
    print(f"-> {args.validation.relative_to(BASE_DIR)}")


if __name__ == "__main__":
    main()
