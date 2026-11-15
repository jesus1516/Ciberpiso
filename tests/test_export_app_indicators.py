import json
import tempfile
import unittest
from pathlib import Path

from pipeline.export_app_indicators import GEOJSON, INDICATORS, exportar


@unittest.skipUnless(
    INDICATORS.exists() and GEOJSON.exists(),
    "requires indicators.json and the app GeoJSON",
)
class TestExportApp(unittest.TestCase):
    def test_export_antequera(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "indicators_antequera.json"
            data = exportar(out_path=out)
            self.assertTrue(out.exists())
            self.assertEqual(data["schema_version"], 1)
            self.assertEqual(len(data["candidates"]), 26)
            self.assertEqual(data["summary"]["fincas"], 26)
            self.assertEqual(data["app_export"]["parcela_ids"], 26)

            pids = {
                f["properties"]["pid"]
                for f in json.loads(GEOJSON.read_text(encoding="utf-8"))["features"]
            }
            for candidate in data["candidates"]:
                self.assertIn(candidate["parcela_id"], pids)
                for rotation in candidate["rotations"].values():
                    for field in (
                        "why",
                        "evidence",
                        "benefits",
                        "data_gaps",
                        "review_risks",
                    ):
                        self.assertTrue(
                            rotation[field], f"{candidate['parcela_id']}/{field}"
                        )

    def test_all_profiles_rank_four(self):
        with tempfile.TemporaryDirectory() as tmp:
            data = exportar(out_path=Path(tmp) / "out.json")
        for candidate in data["candidates"]:
            for profile in data["profiles"]:
                ranks = {
                    rotation["rankings"][profile]["rank"]
                    for rotation in candidate["rotations"].values()
                }
                self.assertEqual(ranks, {1, 2, 3, 4})


if __name__ == "__main__":
    unittest.main()
