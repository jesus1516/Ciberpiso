"""Genera la base SQLite de una copia (ámbito) a partir de sus CSV y su schema.sql.

Comprueba que las columnas de cada CSV coinciden con las de su tabla, carga en
bloque, convierte las celdas vacías en NULL, crea índices y vistas al final, y valida
las claves foráneas.

Solo usa la biblioteca estándar: funciona con cualquier Python 3.8+ sin instalar nada.

Uso (desde la raíz del repo):
    python3 pipeline/cargar_sqlite.py malaga      # -> data/malaga/database/ciberpiso_malaga.sqlite
    python3 pipeline/cargar_sqlite.py andalucia   # -> data/andalucia/database/ciberpiso_andalucia.sqlite
"""

from __future__ import annotations

import argparse
import csv
import sqlite3
import time
from pathlib import Path

# Rutas propias (sin importar pipeline.common, que necesita librerías externas)
DATA = Path(__file__).resolve().parent.parent / "data"


def rutas(ambito: str) -> tuple[Path, Path, Path]:
    """(carpeta de CSV, schema.sql, base por defecto) de data/<ámbito>/."""
    base = DATA / ambito
    return base / "csv", base / "database" / "schema.sql", base / "database" / f"ciberpiso_{ambito}.sqlite"


def ambitos() -> list[str]:
    return sorted(p.parent.name for p in DATA.glob("*/csv") if p.is_dir())


# Orden de carga: primero las tablas referenciadas
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
        raise SystemExit(f"No existe la copia '{ambito}' (faltan {CSV_DIR} o {schema}). Disponibles: {', '.join(ambitos())}")
    db = db or defecto
    db.parent.mkdir(parents=True, exist_ok=True)
    db.unlink(missing_ok=True)
    sec = secciones(schema.read_text(encoding="utf-8"))
    con = sqlite3.connect(db)
    con.executescript("PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; PRAGMA foreign_keys=OFF;")
    con.executescript(sec["tablas"])
    for tabla in ORDEN:
        # csv/comun/<tabla>.csv o un csv/<pp_provincia>/<tabla>.csv por provincia
        ficheros = sorted(CSV_DIR.glob(f"*/{tabla}.csv"))
        if not ficheros:
            raise FileNotFoundError(f"No hay ningún {tabla}.csv en {CSV_DIR}/*/")
        cols_db = [r[1] for r in con.execute(f"PRAGMA table_info({tabla})")]
        t0 = time.time()
        for f in ficheros:
            with f.open(encoding="utf-8", newline="") as fh:
                rd = csv.reader(fh)
                cab = next(rd)
                if sorted(cab) != sorted(cols_db):
                    raise ValueError(f"{f}: columnas {set(cab) ^ set(cols_db)} no coinciden con el esquema")
                q = f"INSERT INTO {tabla} ({', '.join(cab)}) VALUES ({', '.join('?' * len(cab))})"
                con.executemany(q, ([v if v != "" else None for v in fila] for fila in rd))
        n = con.execute(f"SELECT COUNT(*) FROM {tabla}").fetchone()[0]
        print(f"  {tabla}: {n:,} filas de {len(ficheros)} fichero(s) ({time.time() - t0:.1f} s)")
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
    ap.add_argument("ambito", help=f"Copia a cargar: {', '.join(ambitos()) or 'malaga, andalucia'}")
    ap.add_argument("--db", type=Path, default=None, help="Ruta de salida (por defecto, data/<ámbito>/database/)")
    a = ap.parse_args()
    cargar(a.ambito, a.db)


if __name__ == "__main__":
    main()
