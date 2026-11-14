"""Rutas, cliente HTTP con reintentos, descargas reanudables y manifiesto."""

from __future__ import annotations

import hashlib
import json
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
RAW = DATA / "raw"
PROCESSED = DATA / "processed"  # intermedios (parquet, rásteres de trabajo)
SQL_DIR = ROOT / "pipeline" / "sql"  # schema.sql y consultas.sql (fuente única)
# Cada ámbito es una copia completa: data/<ámbito>/csv/ y data/<ámbito>/database/
AMBITOS = {"malaga": [29], "andalucia": [4, 11, 14, 18, 21, 23, 29, 41]}
MANIFEST = DATA / "manifest.json"

USER_AGENT = "ciberpiso-pipeline/0.1 (NASA Space Apps 2026)"


def session() -> requests.Session:
    s = requests.Session()
    retry = Retry(
        total=6,
        backoff_factor=2,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=("GET", "HEAD", "POST"),
    )
    s.mount("https://", HTTPAdapter(max_retries=retry))
    s.mount("http://", HTTPAdapter(max_retries=retry))
    s.headers["User-Agent"] = USER_AGENT
    return s


def sha256(path: Path, chunk: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while block := f.read(chunk):
            h.update(block)
    return h.hexdigest()


def en_manifiesto(file: Path) -> bool:
    if not MANIFEST.exists():
        return False
    rel = str(file.relative_to(ROOT))
    return any(e.get("file") == rel for e in json.loads(MANIFEST.read_text(encoding="utf-8")))


_LOCK = threading.Lock()


def record(source: str, url: str, file: Path, **extra) -> None:
    """Añade o reemplaza la entrada del fichero en data/manifest.json (seguro entre hilos)."""
    with _LOCK:
        _record(source, url, file, **extra)


def _record(source: str, url: str, file: Path, **extra) -> None:
    entries = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else []
    rel = str(file.relative_to(ROOT))
    entries = [e for e in entries if e.get("file") != rel]
    entries.append(
        {
            "source": source,
            "url": url,
            "retrieved_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "file": rel,
            "bytes": file.stat().st_size,
            "sha256": sha256(file),
            **extra,
        }
    )
    entries.sort(key=lambda e: e["file"])
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(entries, ensure_ascii=False, indent=2), encoding="utf-8")


def download(url: str, dest: Path, source: str, expected_size: int | None = None, **extra) -> Path:
    """Descarga reanudable. Si el fichero ya está completo, no hace nada."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and expected_size and dest.stat().st_size == expected_size:
        if not en_manifiesto(dest):
            record(source, url, dest, **extra)
        return dest

    s = session()
    part = dest.with_suffix(dest.suffix + ".part")
    for attempt in range(1, 6):
        offset = part.stat().st_size if part.exists() else 0
        headers = {"Range": f"bytes={offset}-"} if offset else {}
        try:
            with s.get(url, headers=headers, stream=True, timeout=(30, 120)) as r:
                if r.status_code == 416:  # ya completo
                    break
                r.raise_for_status()
                mode = "ab" if r.status_code == 206 else "wb"
                t0, done = time.time(), 0
                with part.open(mode) as f:
                    for block in r.iter_content(1 << 20):
                        f.write(block)
                        done += len(block)
                rate = done / max(time.time() - t0, 1e-6) / 1e6
                print(f"  {dest.name}: {done / 1e6:.0f} MB a {rate:.1f} MB/s")
            if expected_size is None or part.stat().st_size >= expected_size:
                break
        except requests.RequestException as exc:
            print(f"  intento {attempt} fallido para {dest.name}: {exc}")
            time.sleep(5 * attempt)
    else:
        raise RuntimeError(f"No se pudo descargar {url}")

    if expected_size and part.stat().st_size != expected_size:
        raise RuntimeError(
            f"{dest.name}: tamaño {part.stat().st_size} != esperado {expected_size}"
        )
    part.replace(dest)
    record(source, url, dest, **extra)
    return dest
