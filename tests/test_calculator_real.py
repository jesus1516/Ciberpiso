import math
import unittest

from pipeline.calculator import build_indicators


class TestRealIndicators(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = build_indicators()
        cls.candidates = {c["parcela_id"]: c for c in cls.data["candidates"]}

    def test_candidates_and_campaigns(self):
        self.assertEqual(self.data["summary"]["fincas"], 60)
        self.assertEqual(
            self.data["summary"]["campanas"], [2020, 2021, 2022, 2023, 2024, 2025]
        )
        self.assertEqual(len(self.data["candidates"]), 60)
        self.assertEqual(self.data["calibration"]["water_model"], "deficit")
        for candidate in self.data["candidates"]:
            self.assertEqual(len(candidate["rotations"]), 4)
            self.assertEqual(len(candidate["campaigns"]), 6)

    def test_scores_in_range_and_finite(self):
        for candidate in self.data["candidates"]:
            for rid, rotation in candidate["rotations"].items():
                for key in ("water", "water_p20", "soil", "risk"):
                    value = rotation[key]
                    self.assertIsInstance(value, (int, float), f"{rid}: {key}")
                    self.assertFalse(math.isnan(value), f"{rid}: {key} NaN")
                    self.assertGreaterEqual(value, 0.0)
                    self.assertLessEqual(value, 100.0)
                if rotation["profit"] is not None:
                    self.assertGreaterEqual(rotation["profit"], 0.0)
                    self.assertLessEqual(rotation["profit"], 100.0)

    def test_missing_veza_price(self):
        for candidate in self.data["candidates"]:
            r2 = candidate["rotations"]["R2"]
            self.assertIsNone(r2["profit"])
            self.assertIsNone(r2["rankings"]["profit_first"]["rank"])
            self.assertTrue(any("veza" in gap.lower() for gap in r2["data_gaps"]))
            self.assertIsNone(candidate["price_reference"]["veza"]["eur_t"])

    def test_example_farm(self):
        farm = self.candidates["29:15:0:0:62:14"]
        r = farm["rotations"]
        self.assertGreater(r["R3"]["water"], r["R0"]["water"])
        self.assertGreater(r["R1"]["soil"], r["R0"]["soil"])
        self.assertGreater(r["R2"]["soil"], r["R0"]["soil"])
        self.assertGreater(r["R0"]["profit"], r["R1"]["profit"])
        self.assertEqual(r["R0"]["rankings"]["profit_first"]["rank"], 1)
        self.assertEqual(r["R2"]["rankings"]["profit_first"]["rank"], None)

    def test_price_reference_2025(self):
        for candidate in self.data["candidates"]:
            ref = candidate["price_reference"]["trigo"]
            self.assertEqual(ref["anio"], 2024)
            self.assertFalse(ref["mismo_anio_que_campana"])
            self.assertTrue(
                any(
                    "2024" in gap and "precio" in gap.lower()
                    for gap in candidate["rotations"]["R0"]["data_gaps"]
                )
            )

    def test_confidence_levels(self):
        for candidate in self.data["candidates"]:
            self.assertEqual(candidate["rotations"]["R0"]["confidence"], "medium")
            self.assertEqual(candidate["rotations"]["R1"]["confidence"], "medium")
            self.assertEqual(candidate["rotations"]["R2"]["confidence"], "low")
            self.assertEqual(candidate["rotations"]["R3"]["confidence"], "medium")


if __name__ == "__main__":
    unittest.main()
