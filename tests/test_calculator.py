import unittest
from pipeline.calculator import calculate_scores


class TestRotationCalculator(unittest.TestCase):
    def setUp(self):
        self.crops = {
            "trigo": {
                "water_demand": 3.0,
                "cover_months": 5.5,
                "nitrogen_fixer": False,
                "market_ease": 5.0,
                "years_weight": 0.5,
            },
            "girasol": {
                "water_demand": 3.0,
                "cover_months": 4.5,
                "nitrogen_fixer": False,
                "market_ease": 4.0,
                "years_weight": 0.5,
            },
            "garbanzo": {
                "water_demand": 2.0,
                "cover_months": 3.5,
                "nitrogen_fixer": True,
                "market_ease": 2.0,
                "years_weight": 0.3333,
            },
            "veza": {
                "water_demand": 3.0,
                "cover_months": 6.5,
                "nitrogen_fixer": True,
                "market_ease": 2.0,
                "years_weight": 0.3333,
            },
            "barbecho": {
                "water_demand": 0.0,
                "cover_months": 0.5,
                "nitrogen_fixer": False,
                "market_ease": 1.0,
                "years_weight": 0.3333,
            },
        }
        self.prices = {
            "trigo": 250.0,
            "girasol": 450.0,
            "garbanzo": 700.0,
            "veza": 150.0,
            "barbecho": 0.0,
        }

    def test_water_first_prefers_fallow_or_legume(self):
        results = calculate_scores(self.crops, 250.0, 30, self.prices)
        winner = next(
            rid
            for rid, data in results.items()
            if data["rankings"]["water_first"]["rank"] == 1
        )
        self.assertIn(
            winner,
            {"R1", "R3"},
            "En sequía, garbanzo (R1) o barbecho (R3) deben ganar en prioridad agua",
        )
        self.assertGreater(
            results["R3"]["water"],
            results["R0"]["water"],
            "Barbecho (R3) debe tener mejor nota de agua que la rotación actual (R0)",
        )

    def test_soil_first_prefers_veza(self):
        results = calculate_scores(self.crops, 450.0, 15, self.prices)
        self.assertEqual(
            results["R2"]["rankings"]["soil_first"]["rank"],
            1,
            "La veza (R2) debe ganar en prioridad suelo",
        )
        self.assertGreater(
            results["R2"]["soil"],
            results["R0"]["soil"],
            "La veza (R2) debe proteger el suelo mejor que R0",
        )

    def test_profit_first_prefers_current(self):
        results = calculate_scores(self.crops, 450.0, 15, self.prices)
        self.assertEqual(
            results["R0"]["rankings"]["profit_first"]["rank"],
            1,
            "La rotación actual (R0) debe ganar en prioridad rentabilidad",
        )

    def test_all_scores_in_range(self):
        results = calculate_scores(self.crops, 450.0, 15, self.prices)
        for rid, data in results.items():
            for key in ["water", "soil", "profit", "risk"]:
                self.assertTrue(
                    0.0 <= data[key] <= 100.0,
                    f"Nota {key} de {rid} fuera de rango: {data[key]}",
                )
            self.assertIn("low", data["confidence"])
            self.assertTrue(
                len(data["data_gaps"]) >= 2, "Debe haber lagunas de datos declaradas"
            )

    def test_drought_blocks_water_intensive_rotations(self):
        results = calculate_scores(self.crops, 250.0, 30, self.prices)
        for rid in ["R0", "R2"]:
            self.assertEqual(results[rid]["viability"]["status"], "not_viable")
            self.assertFalse(results[rid]["eligible"])
            self.assertIsNone(results[rid]["rankings"]["water_first"]["rank"])
        self.assertIn(
            results["R1"]["viability"]["status"], ["viable", "viable_with_caveats"]
        )
        self.assertIn(
            results["R3"]["viability"]["status"], ["viable", "viable_with_caveats"]
        )

    def test_zero_rainfall_does_not_crash(self):
        results = calculate_scores(self.crops, 0.0, 30, self.prices)
        for data in results.values():
            self.assertEqual(data["water"], 0.0)
            self.assertEqual(data["viability"]["status"], "not_viable")
            self.assertIsNone(data["rankings"]["water_first"]["rank"])

    def test_water_model_switch(self):
        from pipeline.calculator import DEFAULT_CALIBRATION

        precip_cal = {"water_model": "precip", "water_reference_deficit_mm": 900}
        base = calculate_scores(self.crops, 450.0, 15, self.prices)
        ignored = calculate_scores(
            self.crops,
            450.0,
            15,
            self.prices,
            deficit_mm=900.0,
            calibration=precip_cal,
        )
        deficit = calculate_scores(
            self.crops,
            450.0,
            15,
            self.prices,
            deficit_mm=1000.0,
            calibration=DEFAULT_CALIBRATION,
        )
        self.assertEqual(base["R0"]["water"], ignored["R0"]["water"])
        self.assertNotEqual(base["R0"]["water"], deficit["R0"]["water"])


if __name__ == "__main__":
    unittest.main()
