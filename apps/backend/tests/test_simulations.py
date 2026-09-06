import unittest
from decimal import Decimal
from uuid import uuid4

from pydantic import ValidationError

from apps.backend.app.domain.simulations import calculate_simulation_totals
from apps.backend.app.schemas import SimulationCreate, SimulationItemCreate


class SimulationDomainTests(unittest.TestCase):
    def test_totals_and_progression_inputs_are_kept_separate_from_real_transactions(self):
        food_id = uuid4()
        totals = calculate_simulation_totals(
            [
                {"direction": "income", "amount": Decimal("3000.00"), "category_id": None, "category_name": None},
                {"direction": "income", "amount": Decimal("600.00"), "category_id": food_id, "category_name": "Alimentação"},
                {"direction": "expense", "amount": Decimal("100.00"), "category_id": None, "category_name": None},
                {"direction": "expense", "amount": Decimal("300.00"), "category_id": food_id, "category_name": "Alimentação"},
            ]
        )

        self.assertEqual(totals["total_income"], Decimal("3600.00"))
        self.assertEqual(totals["total_expenses"], Decimal("400.00"))
        self.assertEqual(totals["final_balance"], Decimal("3200.00"))
        self.assertEqual(
            [(row["category_name"], row["amount"]) for row in totals["expenses_by_category"]],
            [("Alimentação", Decimal("300.00")), ("Sem categoria", Decimal("100.00"))],
        )

    def test_negative_balance_is_a_valid_scenario_result(self):
        totals = calculate_simulation_totals(
            [{"direction": "expense", "amount": Decimal("100.00"), "category_id": None, "category_name": None}]
        )
        self.assertEqual(totals["final_balance"], Decimal("-100.00"))


class SimulationSchemaTests(unittest.TestCase):
    def test_simulation_text_is_normalized(self):
        payload = SimulationCreate(name="  Comprar notebook  ", reference="  Setembro  ")
        self.assertEqual(payload.name, "Comprar notebook")
        self.assertEqual(payload.reference, "Setembro")

    def test_simulation_period_is_structured_and_requires_a_pair(self):
        payload = SimulationCreate(name="Setembro", period_year=2026, period_month=9)
        self.assertEqual((payload.period_year, payload.period_month), (2026, 9))
        with self.assertRaises(ValidationError):
            SimulationCreate(name="Sem mês", period_year=2026)

    def test_item_requires_positive_amount(self):
        with self.assertRaises(ValidationError):
            SimulationItemCreate(description="Compra", direction="expense", amount="-10")


if __name__ == "__main__":
    unittest.main()
