import math
import unittest

from pipeline.calibrate import (
    REFERENCE_DEFICIT_MM,
    auc,
    best_threshold,
    construir_validacion,
    spearman,
)


class TestMetrics(unittest.TestCase):
    def test_auc(self):
        self.assertAlmostEqual(auc([0, 0, 1, 1], [0, 0, 1, 1]), 1.0)
        self.assertAlmostEqual(auc([0, 0, 1, 1], [4, 3, 2, 1]), 0.0)
        self.assertAlmostEqual(auc([0, 1], [1, 1]), 0.5)
        self.assertIsNone(auc([0, 0], [1, 2]))

    def test_spearman(self):
        self.assertAlmostEqual(spearman([1, 2, 3], [2, 4, 6]), 1.0)
        self.assertAlmostEqual(spearman([1, 2, 3], [6, 4, 2]), -1.0)
        self.assertIsNone(spearman([1], [1]))

    def test_best_threshold(self):
        r = best_threshold([0, 0, 1, 1], [1.0, 2.0, 3.0, 4.0])
        self.assertEqual(r["threshold"], 3.0)
        self.assertEqual(r["balanced_accuracy"], 1.0)
        self.assertEqual(r["confusion"], {"tp": 2, "fp": 0, "tn": 2, "fn": 0})


class TestValidation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.validation, cls.calibration = construir_validacion()

    def test_dataset(self):
        self.assertEqual(self.validation["dataset"]["filas"], 360)
        self.assertEqual(self.validation["dataset"]["fincas"], 60)
        self.assertEqual(self.validation["dataset"]["municipios"], 12)

    def test_decision(self):
        d = self.validation["decision"]
        self.assertEqual(d["modelo_adoptado"], "deficit")
        self.assertGreaterEqual(d["mejora_auc"], 0.05)
        self.assertGreaterEqual(d["mejora_spearman_ndvi_jun_ago"], 0.05)
        self.assertGreaterEqual(d["mejora_lomo_auc"], 0.03)

    def test_deficit_beats_precip(self):
        base = self.validation["modelos"]["precip"]["exito_estival"]
        cand = self.validation["modelos"]["deficit"]["exito_estival"]
        self.assertGreater(cand["auc"], base["auc"])
        self.assertGreater(cand["auc"], 0.70)
        self.assertGreater(cand["spearman_ndvi_jun_ago"], base["spearman_ndvi_jun_ago"])
        self.assertGreater(cand["spearman_ndvi_jun_ago"], 0.45)

    def test_clase_arable_is_negative_control(self):
        for model in ("precip", "deficit"):
            self.assertLess(
                self.validation["modelos"][model]["clase_arable"]["auc"], 0.60
            )

    def test_lomo(self):
        lomo = self.validation["leave_one_municipality_out"]
        self.assertEqual(len(lomo["deficit"]["exito_estival"]["folds"]), 12)
        self.assertGreater(
            lomo["deficit"]["exito_estival"]["auc_ponderada"],
            lomo["precip"]["exito_estival"]["auc_ponderada"],
        )
        self.assertGreater(lomo["deficit"]["exito_estival"]["auc_ponderada"], 0.70)

    def test_calibration(self):
        self.assertEqual(self.calibration["water_model"], "deficit")
        self.assertEqual(
            self.calibration["water_reference_deficit_mm"], REFERENCE_DEFICIT_MM
        )
        self.assertEqual(self.calibration["version"], 1)
        for value in self.calibration["validacion"].values():
            self.assertFalse(math.isnan(value))
            self.assertGreaterEqual(value, 0.0)
            self.assertLessEqual(value, 1.0)


if __name__ == "__main__":
    unittest.main()
