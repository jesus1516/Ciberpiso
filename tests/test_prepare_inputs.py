import csv
import unittest
from pathlib import Path

from pipeline.prepare_inputs import (
    DB_PATH,
    CAMPOS,
    build_scenarios,
    errores,
    resumen_calidad,
)

BASE_DIR = Path(__file__).resolve().parent.parent
CROPS = BASE_DIR / "data" / "crops.csv"


class TestCropsCatalog(unittest.TestCase):
    def setUp(self):
        with CROPS.open(newline="", encoding="utf-8") as fh:
            self.rows = list(csv.DictReader(fh))

    def test_crops_expected(self):
        ids = {r["crop_id"] for r in self.rows}
        self.assertEqual(ids, {"trigo", "girasol", "garbanzo", "veza", "barbecho"})

    def test_required_fields(self):
        for row in self.rows:
            for field in (
                "nombre",
                "grupo",
                "water_demand_1_5",
                "cover_months",
                "nitrogen_fixer",
                "rotation_years",
                "market_ease_1_5",
                "main_risk",
                "source",
                "confidence",
            ):
                self.assertTrue(row[field].strip(), f"{row['crop_id']}: {field} vacío")
            self.assertIn(row["nitrogen_fixer"], {"0", "1"})
            self.assertGreaterEqual(float(row["water_demand_1_5"]), 0)
            self.assertLessEqual(float(row["water_demand_1_5"]), 5)
            self.assertGreaterEqual(float(row["cover_months"]), 0)
            self.assertLessEqual(float(row["cover_months"]), 12)

    def test_price_codes(self):
        by_id = {r["crop_id"]: r for r in self.rows}
        self.assertEqual(by_id["trigo"]["precio_producto_codigo"], "01110000")
        self.assertEqual(by_id["girasol"]["precio_producto_codigo"], "02120000")
        self.assertEqual(by_id["garbanzo"]["precio_producto_codigo"], "02992000")
        self.assertEqual(by_id["veza"]["precio_producto_codigo"], "")
        self.assertEqual(by_id["barbecho"]["precio_producto_codigo"], "")


@unittest.skipUnless(
    DB_PATH.exists(),
    f"requiere {DB_PATH}; ejecuta python3 pipeline/cargar_sqlite.py",
)
class TestScenarios(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows = build_scenarios()
        cls.qa = resumen_calidad(cls.rows)

    def test_shape(self):
        self.assertEqual(len(self.rows), 360)
        self.assertEqual(len({r["finca_key"] for r in self.rows}), 60)
        self.assertEqual(
            sorted({r["campana"] for r in self.rows}),
            [2020, 2021, 2022, 2023, 2024, 2025],
        )
        self.assertEqual(len({(r["finca_key"], r["campana"]) for r in self.rows}), 360)

    def test_columns_and_critical_nulls(self):
        self.assertEqual(list(self.rows[0]), CAMPOS)
        self.assertEqual(sum(self.qa["nulos_criticos"].values()), 0)

    def test_ranges(self):
        self.assertEqual(errores(self.qa), [])

    def test_derived_flags(self):
        self.assertTrue(all(r["exito_estival"] in (0, 1) for r in self.rows))
        self.assertTrue(all(r["clase_arable"] in (0, 1) for r in self.rows))
        self.assertEqual(sum(r["exito_estival"] for r in self.rows), 44)

    def test_prices(self):
        p = self.qa["precios"]
        self.assertEqual(p["trigo"], 300)
        self.assertEqual(p["girasol"], 300)
        self.assertEqual(p["garbanzo"], 300)
        self.assertEqual(p["veza"], 0)
        self.assertEqual(p["barbecho"], 360)
        self.assertEqual(p["r0_completo"], 300)
        self.assertEqual(p["r1_completo"], 300)
        self.assertEqual(p["r2_completo"], 0)
        self.assertEqual(p["r3_completo"], 360)
        self.assertEqual(p["anios_con_precio"], [2020, 2021, 2022, 2023, 2024])
        for row in self.rows:
            if row["campana"] == 2025:
                self.assertIsNone(row["precio_trigo_eur_t"])
                self.assertIsNone(row["precio_anio"])


if __name__ == "__main__":
    unittest.main()
