"""The app's rotation engine reads its parameters from app/src/data/engine.json; it must match the pipeline."""

import csv

import pytest

from pipeline import export_app_engine as eae
from pipeline.calculator import PROFILES, ROTATIONS


def test_engine_json_is_up_to_date():
    """Fails when data/crops.csv, data/calibration.json or calculator.py change without re-exporting."""
    expected = eae.render(eae.build())
    assert eae.OUT.read_text(encoding="utf-8") == expected, "Run: python3 -m pipeline.export_app_engine"


def test_engine_has_the_pipeline_rotations_and_profiles():
    data = eae.build()
    assert data["rotations"] == {rid: info["crops"] for rid, info in ROTATIONS.items()}
    assert data["profiles"] == PROFILES
    assert set(data["crops"]) == {c for crops in data["rotations"].values() for c in crops}


def test_missing_rotation_crop_is_an_error(tmp_path):
    rows = list(csv.DictReader(eae.CROPS_PATH.open(encoding="utf-8")))
    path = tmp_path / "crops.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=rows[0].keys())
        w.writeheader()
        w.writerows(r for r in rows if r["crop_id"] != "veza")
    with pytest.raises(ValueError, match="veza"):
        eae.build(crops_path=path)
