"""Genera la base SQLite a partir de data/csv/ y de data/database/schema.sql.

Comprueba que las columnas de cada CSV coinciden con las de su tabla, carga en
bloque, convierte las celdas vacías en NULL, crea índices y vistas al final, y valida
las claves foráneas.

Solo usa la biblioteca estándar: funciona con cualquier Python 3.8+ sin instalar nada.

Uso (desde la raíz del repo):
    python pipeline/cargar_sqlite.py            # -> data/database/ciberpiso.sqlite
    python -m pipeline.cargar_sqlite            # equivalente
"""

from __future__ import annotations

import argparse
import csv
import sqlite3
import time
from pathlib import Path

# Rutas propias (sin importar pipeline.common, que necesita librerías externas)
DATA = Path(__file__).resolve().parent.parent / "data"
CSV_DIR = DATA / "csv"
DB_DIR = DATA / "database"
DB_PATH = DB_DIR / "ciberpiso.sqlite"
SCHEMA = DB_DIR / "schema.sql"
# Orden de carga: primero las tablas referenciadas
ORDEN = ["dim_municipio", "dim_celda_power", "fincas", "recintos", "suelo_fincas", "fenologia_fincas",
         "ndvi_fincas", "clima_anual", "suelo_humedad_anual", "dim_producto_precio", "precios_anuales"]


def secciones(sql: str) -> dict[str, str]:
    out, actual = {}, None
    for linea in sql.splitlines():
        if linea.startswith("-- @"):
            actual = linea[4:].split()[0]
            out[actual] = ""
        elif actual:
            out[actual] += linea + "\n"
    return out


def cargar(db: Path) -> None:
    db.unlink(missing_ok=True)
    sec = secciones(SCHEMA.read_text(encoding="utf-8"))
    con = sqlite3.connect(db)
    con.executescript("PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; PRAGMA foreign_keys=OFF;")
    con.executescript(sec["tablas"])
    for tabla in ORDEN:
        f = CSV_DIR / f"{tabla}.csv"
        cols_db = [r[1] for r in con.execute(f"PRAGMA table_info({tabla})")]
        with f.open(encoding="utf-8", newline="") as fh:
            rd = csv.reader(fh)
            cab = next(rd)
            if sorted(cab) != sorted(cols_db):
                raise ValueError(f"{tabla}: columnas CSV {set(cab) ^ set(cols_db)} no coinciden con el esquema")
            t0 = time.time()
            q = f"INSERT INTO {tabla} ({', '.join(cab)}) VALUES ({', '.join('?' * len(cab))})"
            con.executemany(q, ([v if v != "" else None for v in fila] for fila in rd))
        n = con.execute(f"SELECT COUNT(*) FROM {tabla}").fetchone()[0]
        print(f"  {tabla}: {n:,} filas ({time.time() - t0:.1f} s)")
    con.commit()
    con.executescript(sec["indices"] + sec["vistas"])
    malos = con.execute("PRAGMA foreign_key_check").fetchall()
    if malos:
        raise ValueError(f"{len(malos)} filas violan claves foráneas, p. ej. {malos[:3]}")
    con.execute("ANALYZE")
    con.commit()
    con.execute("VACUUM")
    con.close()
    print(f"-> {db} ({db.stat().st_size / 1e6:.0f} MB); claves foráneas OK")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--db", type=Path, default=DB_PATH)
    cargar(ap.parse_args().db)


if __name__ == "__main__":
    main()
