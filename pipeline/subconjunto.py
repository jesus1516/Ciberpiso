"""Create a copy with a subset of provinces from one that is already built.

The keys (finca_key, recinto_key, municipio_key) do not depend on which other provinces
are in the copy, so it is enough to copy the province folders and filter the
common tables. Rows are copied as they are, without reformatting.

Usage:
    python -m pipeline.subconjunto --de andalucia --a malaga          # provinces of AMBITOS["malaga"]
    python -m pipeline.subconjunto --de andalucia --a sevilla --provincias 41
"""

from __future__ import annotations

import argparse
import csv
import shutil

from pipeline.common import AMBITOS, DATA, SQL_DIR

# Common tables that are filtered by the climate cells of the copied farms
POR_CELDA = ["dim_celda_power", "clima_anual", "suelo_humedad_anual"]


def filtrar(origen, destino, campo: str, valores: set[str]) -> int:
    n = 0
    with origen.open(encoding="utf-8", newline="") as fi, destino.open("w", encoding="utf-8", newline="") as fo:
        rd, wr = csv.reader(fi), csv.writer(fo, lineterminator="\n")
        cab = next(rd)
        wr.writerow(cab)
        i = cab.index(campo)
        for fila in rd:
            if fila[i] in valores:
                wr.writerow(fila)
                n += 1
    return n


def crear(de: str, a: str, provincias: list[int]) -> None:
    src, dst = DATA / de / "csv", DATA / a / "csv"
    if not src.is_dir():
        raise SystemExit(f"{src} does not exist: first build the copy '{de}' with pipeline.build")
    if dst.exists():
        shutil.rmtree(dst)  # generated output: rebuilt entirely
    (dst / "comun").mkdir(parents=True)

    celdas: set[str] = set()
    for p in provincias:
        carpeta = next(src.glob(f"{p:02d}_*"), None)
        if carpeta is None:
            raise SystemExit(f"Copy '{de}' does not have province {p}")
        shutil.copytree(carpeta, dst / carpeta.name)
        with (carpeta / "fincas.csv").open(encoding="utf-8", newline="") as fh:
            rd = csv.reader(fh)
            i = next(rd).index("celda_power")
            celdas.update(fila[i] for fila in rd)
        print(f"  {carpeta.name}/ copied")

    for f in sorted((src / "comun").glob("*.csv")):
        if f.stem in POR_CELDA:
            n = filtrar(f, dst / "comun" / f.name, "celda_power", celdas)
            print(f"  comun/{f.name}: {n:,} rows ({len(celdas)} climate cells)")
        else:
            shutil.copy2(f, dst / "comun" / f.name)
            print(f"  comun/{f.name}: copied whole")

    db = DATA / a / "database"
    db.mkdir(parents=True, exist_ok=True)
    for sql in SQL_DIR.glob("*.sql"):
        shutil.copy2(sql, db / sql.name)
    print(f"-> data/{a}/csv/ y data/{a}/database/*.sql. Carga la base con: python3 pipeline/cargar_sqlite.py {a}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--de", default="andalucia", help="Source copy that is already built")
    ap.add_argument("--a", required=True, help="Name of the new copy (folder data/<name>/)")
    ap.add_argument("--provincias", default=None, help="Comma-separated codes (by default, those of AMBITOS)")
    args = ap.parse_args()
    if args.provincias:
        provs = [int(p) for p in args.provincias.split(",")]
    elif args.a in AMBITOS:
        provs = AMBITOS[args.a]
    else:
        raise SystemExit(f"Give --provincias for '{args.a}' (it is not in AMBITOS)")
    crear(args.de, args.a, provs)


if __name__ == "__main__":
    main()
