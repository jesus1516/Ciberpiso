"""Generate the SQLite database of a copy (scope) from its CSVs and its schema.sql.

Checks that the columns of each CSV match those of its table, loads in bulk,
turns empty cells into NULL, creates indexes and views at the end, and validates
the foreign keys.

It only uses the standard library: it works with any Python 3.8+ without installing anything.

Usage (from the repo root):
    python3 pipeline/cargar_sqlite.py malaga      # -> data/malaga/database/ciberpiso_malaga.sqlite
    python3 pipeline/cargar_sqlite.py andalucia   # -> data/andalucia/database/ciberpiso_andalucia.sqlite
"""

from __future__ import annotations

import argparse
import csv
import sqlite3
import time
from pathlib import Path

# Own paths (without importing pipeline.common, which needs external libraries)
DATA = Path(__file__).resolve().parent.parent / "data"


def rutas(ambito: str) -> tuple[Path, Path, Path]:
    """(CSV folder, schema.sql, default database) of data/<scope>/."""
    base = DATA / ambito
    return base / "csv", base / "database" / "schema.sql", base / "database" / f"ciberpiso_{ambito}.sqlite"


def ambitos() -> list[str]:
    return sorted(p.parent.name for p in DATA.glob("*/csv") if p.is_dir())


# Load order: referenced tables first
ORDEN = ["dim_municipio", "dim_celda_power", "fincas", "recintos", "suelo_fincas", "fenologia_fincas",
         "ndvi_fincas", "clima_anual", "suelo_humedad_anual", "dim_producto_precio", "precios_anuales",
         "precios_veza"]


def secciones(sql: str) -> dict[str, str]:
    out, actual = {}, None
    for linea in sql.splitlines():
        if linea.startswith("-- @"):
            actual = linea[4:].split()[0]
            out[actual] = ""
        elif actual:
            out[actual] += linea + "\n"
    return out


def cargar(ambito: str, db: Path | None = None) -> None:
    CSV_DIR, schema, defecto = rutas(ambito)
    if not CSV_DIR.is_dir() or not schema.exists():
        raise SystemExit(f"Copy '{ambito}' does not exist ({CSV_DIR} or {schema} missing). Available: {', '.join(ambitos())}")
    db = db or defecto
    db.parent.mkdir(parents=True, exist_ok=True)
    db.unlink(missing_ok=True)
    sec = secciones(schema.read_text(encoding="utf-8"))
    con = sqlite3.connect(db)
    con.executescript("PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; PRAGMA foreign_keys=OFF;")
    con.executescript(sec["tablas"])
    for tabla in ORDEN:
        # csv/comun/<table>.csv or one csv/<pp_provincia>/<table>.csv per province
        ficheros = sorted(CSV_DIR.glob(f"*/{tabla}.csv"))
        if not ficheros:
            raise FileNotFoundError(f"No {tabla}.csv found in {CSV_DIR}/*/")
        cols_db = [r[1] for r in con.execute(f"PRAGMA table_info({tabla})")]
        t0 = time.time()
        for f in ficheros:
            with f.open(encoding="utf-8", newline="") as fh:
                rd = csv.reader(fh)
                cab = next(rd)
                if sorted(cab) != sorted(cols_db):
                    raise ValueError(f"{f}: columns {set(cab) ^ set(cols_db)} do not match the schema")
                q = f"INSERT INTO {tabla} ({', '.join(cab)}) VALUES ({', '.join('?' * len(cab))})"
                con.executemany(q, ([v if v != "" else None for v in fila] for fila in rd))
        n = con.execute(f"SELECT COUNT(*) FROM {tabla}").fetchone()[0]
        print(f"  {tabla}: {n:,} rows from {len(ficheros)} file(s) ({time.time() - t0:.1f} s)")
    con.commit()
    con.executescript(sec["indices"] + sec["vistas"])
    malos = con.execute("PRAGMA foreign_key_check").fetchall()
    if malos:
        raise ValueError(f"{len(malos)} rows violate foreign keys, e.g. {malos[:3]}")
    con.execute("ANALYZE")
    con.commit()
    con.execute("VACUUM")
    con.close()
    print(f"-> {db} ({db.stat().st_size / 1e6:.0f} MB); foreign keys OK")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("ambito", help=f"Copy to load: {', '.join(ambitos()) or 'malaga, andalucia'}")
    ap.add_argument("--db", type=Path, default=None, help="Output path (by default, data/<scope>/database/)")
    a = ap.parse_args()
    cargar(a.ambito, a.db)


if __name__ == "__main__":
    main()
