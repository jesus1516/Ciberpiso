import unittest

from pipeline.audit import auditar
from pipeline.calculator import build_indicators, normalizar_pesos


class TestCompliance(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = build_indicators()
        cls.audit = auditar(cls.data)
        cls.candidates = {c["parcela_id"]: c for c in cls.data["candidates"]}

    def test_audit_ok(self):
        self.assertTrue(self.audit["ok"], self.audit["fallos"])
        self.assertEqual(self.audit["fincas"], 60)
        self.assertEqual(self.audit["rotaciones"], 240)
        self.assertEqual(self.audit["indicadores"], 960)

    def test_five_required_fields(self):
        for candidate in self.data["candidates"]:
            for rid, rotation in candidate["rotations"].items():
                self.assertTrue(rotation["why"])
                self.assertTrue(rotation["evidence"])
                self.assertTrue(rotation["benefits"])
                self.assertTrue(rotation["data_gaps"])
                self.assertTrue(rotation["review_risks"])

    def test_indicator_metadata(self):
        for candidate in self.data["candidates"]:
            for rid, rotation in candidate["rotations"].items():
                for key in ("water", "soil", "profit", "risk"):
                    ind = rotation["indicators"][key]
                    for field in ("unit", "source", "date", "confidence", "gap"):
                        self.assertTrue(ind[field], f"{rid}/{key}/{field}")
                    if key == "profit" and rotation["profit"] is None:
                        self.assertIsNone(ind["value"])
                    else:
                        self.assertIsNotNone(ind["value"])

    def test_global_contract(self):
        self.assertIn("no sustituye", self.data["disclaimer"].lower())
        self.assertTrue(self.data["glossary"])
        self.assertTrue(self.data["sources"])
        self.assertEqual(self.data["calibration"]["water_model"], "deficit")

    def test_r1_r2_differentiated(self):
        for candidate in self.data["candidates"]:
            r1 = candidate["rotations"]["R1"]
            r2 = candidate["rotations"]["R2"]
            self.assertNotEqual(r1["soil"], r2["soil"])

    def test_r2_is_comparable(self):
        for candidate in self.data["candidates"]:
            r2 = candidate["rotations"]["R2"]
            self.assertTrue(r2["comparable"])
            self.assertIsNotNone(r2["profit"])
            self.assertIn("MAPA", r2["indicators"]["profit"]["source"])
            for profile, ranking in r2["rankings"].items():
                self.assertFalse(ranking["partial"])
                self.assertIsNotNone(ranking["final_score"])
                self.assertIsNotNone(ranking["rank"])
                self.assertIsNone(ranking["partial_score"])

    def test_custom_weights_and_constraints(self):
        data = build_indicators(
            custom_weights={"water": 0.5, "soil": 0.3, "profit": 0.1, "risk": 0.1},
            constraints={"market_safe": True, "max_crops": 2},
        )
        self.assertIn("custom", data["profiles"])
        self.assertEqual(data["custom_weights"]["water"], 0.5)
        self.assertTrue(data["constraints"]["market_safe"])
        self.assertIn("custom", data["summary"]["top_por_perfil"])
        for candidate in data["candidates"]:
            r0 = candidate["rotations"]["R0"]
            self.assertTrue(r0["eligible"])
            self.assertEqual(r0["rankings"]["custom"]["rank"], 1)
            for rid in ("R1", "R2", "R3"):
                self.assertFalse(candidate["rotations"][rid]["eligible"])

    def test_weight_validation(self):
        self.assertAlmostEqual(
            sum(normalizar_pesos({"water": 1, "soil": 1}).values()), 1.0
        )
        with self.assertRaises(ValueError):
            normalizar_pesos({"water": -1})
        with self.assertRaises(ValueError):
            normalizar_pesos({"water": 0, "soil": 0})
        with self.assertRaises(ValueError):
            normalizar_pesos({"maquinaria": 1})


if __name__ == "__main__":
    unittest.main()
