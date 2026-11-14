"""Crea una copia con un subconjunto de provincias a partir de otra ya construida.

Las claves (finca_key, recinto_key, municipio_key) no dependen de qué otras provincias
haya en la copia, así que basta con copiar las carpetas de las provincias y filtrar las
tablas comunes. Las filas se copian tal cual, sin reformatear.

Uso:
    python -m pipeline.subconjunto --de andalucia --a malaga          # provincias de AMBITOS["malaga"]
    python -m pipeline.subconjunto --de andalucia --a sevilla --provincias 41
"""

from __future__ import annotations

import argparse
import csv
import shutil

from pipeline.common import AMBITOS, DATA, SQL_DIR

# Tablas comunes que se filtran por las celdas de clima de las fincas copiadas
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
        raise SystemExit(f"No existe {src}: construye primero la copia '{de}' con pipeline.build")
    if dst.exists():
        shutil.rmtree(dst)  # salida generada: se rehace entera
    (dst / "comun").mkdir(parents=True)

    celdas: set[str] = set()
    for p in provincias:
        carpeta = next(src.glob(f"{p:02d}_*"), None)
        if carpeta is None:
            raise SystemExit(f"La copia '{de}' no tiene la provincia {p}")
        shutil.copytree(carpeta, dst / carpeta.name)
        with (carpeta / "fincas.csv").open(encoding="utf-8", newline="") as fh:
            rd = csv.reader(fh)
            i = next(rd).index("celda_power")
            celdas.update(fila[i] for fila in rd)
        print(f"  {carpeta.name}/ copiada")

    for f in sorted((src / "comun").glob("*.csv")):
        if f.stem in POR_CELDA:
            n = filtrar(f, dst / "comun" / f.name, "celda_power", celdas)
            print(f"  comun/{f.name}: {n:,} filas ({len(celdas)} celdas de clima)")
        else:
            shutil.copy2(f, dst / "comun" / f.name)
            print(f"  comun/{f.name}: copiado entero")

    db = DATA / a / "database"
    db.mkdir(parents=True, exist_ok=True)
    for sql in SQL_DIR.glob("*.sql"):
        shutil.copy2(sql, db / sql.name)
    print(f"-> data/{a}/csv/ y data/{a}/database/*.sql. Carga la base con: python3 pipeline/cargar_sqlite.py {a}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--de", default="andalucia", help="Copia de origen ya construida")
    ap.add_argument("--a", required=True, help="Nombre de la copia nueva (carpeta data/<nombre>/)")
    ap.add_argument("--provincias", default=None, help="Códigos separados por comas (por defecto, los de AMBITOS)")
    args = ap.parse_args()
    if args.provincias:
        provs = [int(p) for p in args.provincias.split(",")]
    elif args.a in AMBITOS:
        provs = AMBITOS[args.a]
    else:
        raise SystemExit(f"Indica --provincias para '{args.a}' (no está en AMBITOS)")
    crear(args.de, args.a, provs)


if __name__ == "__main__":
    main()
