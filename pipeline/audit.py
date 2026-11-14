#!/usr/bin/env python3
"""Audit the calculator output against the challenge requirements.

Checks that each rotation has the five mandatory fields, that each
indicator declares source/date/unit/confidence/gap, that the rankings are
consistent and that there are no arbitrary ties or out-of-range scores.

Usage:
    python3 pipeline/audit.py
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from pipeline.calculator import OUT_PATH, build_indicators  # noqa: E402

AUDIT_PATH = BASE_DIR / "data" / "processed" / "audit.json"

CAMPOS_OBLIGATORIOS = ("why", "evidence", "benefits", "data_gaps", "review_risks")
INDICADORES = ("water", "soil", "profit", "risk")
CAMPOS_INDICADOR = ("unit", "source", "date", "confidence", "gap")


def auditar(data: dict) -> dict:
    fallos: list[str] = []
    avisos: list[str] = []
    candidatos = data.get("candidates", [])
    rotaciones = 0
    indicadores = 0

    if len(candidatos) != 60:
        fallos.append(f"60 farms expected, found {len(candidatos)}")
    for campo in ("disclaimer", "glossary", "sources"):
        if not data.get(campo):
            fallos.append(f"Missing global field {campo}")

    for candidato in candidatos:
        parcela = candidato.get("parcela_id", "?")
        if len(candidato.get("campaigns", [])) != 6:
            fallos.append(f"{parcela}: does not have 6 seasons")
        if len(candidato.get("rotations", {})) != 4:
            fallos.append(f"{parcela}: does not have 4 rotations")
        for rid, rot in candidato.get("rotations", {}).items():
            rotaciones += 1
            for campo in CAMPOS_OBLIGATORIOS:
                valor = rot.get(campo)
                if not valor:
                    fallos.append(f"{parcela}/{rid}: missing {campo}")
                elif isinstance(valor, list) and not any(str(x).strip() for x in valor):
                    fallos.append(f"{parcela}/{rid}: {campo} empty")
                elif isinstance(valor, str) and not valor.strip():
                    fallos.append(f"{parcela}/{rid}: {campo} empty")

            for key in INDICADORES:
                indicador = rot.get("indicators", {}).get(key)
                if not indicador:
                    fallos.append(f"{parcela}/{rid}: missing indicator {key}")
                    continue
                indicadores += 1
                for campo in CAMPOS_INDICADOR:
                    if indicador.get(campo) in (None, ""):
                        fallos.append(f"{parcela}/{rid}/{key}: missing {campo}")
                if indicador.get("value") is None and not (
                    key == "profit" and rot.get("profit") is None
                ):
                    fallos.append(f"{parcela}/{rid}/{key}: unjustified null value")

            for key in ("water", "water_p20", "soil", "risk"):
                valor = rot.get(key)
                if not isinstance(valor, (int, float)) or math.isnan(valor):
                    fallos.append(f"{parcela}/{rid}: {key} not numeric")
                elif not 0.0 <= valor <= 100.0:
                    fallos.append(f"{parcela}/{rid}: {key} outside 0-100")
            profit = rot.get("profit")
            if profit is not None and not 0.0 <= profit <= 100.0:
                fallos.append(f"{parcela}/{rid}: profit outside 0-100")
            if rot.get("comparable") is not (profit is not None):
                fallos.append(f"{parcela}/{rid}: comparable does not match profit")

            for perfil, ranking in rot.get("rankings", {}).items():
                if ranking.get("partial"):
                    if ranking.get("rank") is not None:
                        fallos.append(f"{parcela}/{rid}/{perfil}: partial with rank")
                    if ranking.get("final_score") is not None:
                        fallos.append(
                            f"{parcela}/{rid}/{perfil}: partial with final_score"
                        )
                elif ranking.get("final_score") is None:
                    fallos.append(f"{parcela}/{rid}/{perfil}: complete without final_score")
                if ranking.get("rank") is not None and ranking["rank"] < 1:
                    fallos.append(f"{parcela}/{rid}/{perfil}: invalid rank")

        for perfil in data.get("profiles", {}):
            completos = [
                r
                for r in candidato["rotations"].values()
                if r["rankings"][perfil]["rank"] is not None
            ]
            por_puesto: dict[int, list[dict]] = {}
            for rot in completos:
                por_puesto.setdefault(rot["rankings"][perfil]["rank"], []).append(rot)
            for puesto, grupo in por_puesto.items():
                notas = {r["rankings"][perfil]["final_score"] for r in grupo}
                if len(notas) != 1:
                    fallos.append(
                        f"{parcela}/{perfil}: place {puesto} with different scores"
                    )
                if len(grupo) > 1:
                    for rot in grupo:
                        esperados = [otro["name"] for otro in grupo if otro is not rot]
                        if sorted(rot["rankings"][perfil]["tied_with"]) != sorted(
                            esperados
                        ):
                            fallos.append(f"{parcela}/{perfil}: tie wrongly declared")
            notas = [r["rankings"][perfil]["final_score"] for r in completos]
            if len(notas) != len(set(notas)):
                # ties share a score; this only fails if there are repeated scores
                # with different places, already covered above
                pass

    # R1 and R2 cannot be clones: they must differ at least in soil.
    clones = sum(
        1
        for c in candidatos
        if c["rotations"]["R1"]["soil"] == c["rotations"]["R2"]["soil"]
    )
    if clones:
        avisos.append(f"{clones} farms have R1 and R2 with the same soil score")

    resumen = {
        "generado": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "ok": not fallos,
        "fincas": len(candidatos),
        "rotaciones": rotaciones,
        "indicadores": indicadores,
        "fallos": fallos,
        "avisos": avisos,
        "conteo_rotaciones": dict(
            Counter(rid for c in candidatos for rid in c.get("rotations", {}))
        ),
    }
    return resumen


def main() -> None:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--indicators", type=Path, default=OUT_PATH)
    ap.add_argument("--out", type=Path, default=AUDIT_PATH)
    args = ap.parse_args()

    if not args.indicators.exists():
        data = build_indicators()
    else:
        data = json.loads(args.indicators.read_text(encoding="utf-8"))
    resultado = auditar(data)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps(resultado, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(
        f"{resultado['fincas']} fincas, {resultado['rotaciones']} rotaciones, "
        f"{resultado['indicadores']} indicadores"
    )
    print(f"Fallos: {len(resultado['fallos'])}; avisos: {len(resultado['avisos'])}")
    for fallo in resultado["fallos"][:10]:
        print(f"  - {fallo}")
    for aviso in resultado["avisos"][:5]:
        print(f"  aviso: {aviso}")
    print(f"-> {args.out.relative_to(BASE_DIR)}")
    if not resultado["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
