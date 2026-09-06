import unittest
from datetime import date
from decimal import Decimal
from uuid import uuid4

from apps.backend.app.domain.budgets import calculate_allocation
from apps.backend.app.domain.calendar import business_day_date, month_bounds
from apps.backend.app.domain.commitments import (
    first_commitment_occurrence,
    fixed_commitment_date,
    next_commitment_due_date,
    next_projected_commitment_date,
    projected_commitment_date,
)
from apps.backend.app.main import process_due_commitments
from apps.backend.app.schemas import BudgetAllocationMode


class DomainRulesTests(unittest.TestCase):
    def test_calendar_handles_december_rollover_and_sunday(self):
        self.assertEqual(
            month_bounds(2026, 12),
            (date(2026, 12, 1), date(2027, 1, 1)),
        )
        self.assertEqual(business_day_date(2026, 2, 1), date(2026, 2, 2))
        # Saturday is a business day for Cifro's Brazilian due-date rule.
        self.assertEqual(business_day_date(2026, 8, 5), date(2026, 8, 6))

    def test_fixed_day_is_clamped_in_short_month(self):
        self.assertEqual(fixed_commitment_date(2026, 2, 31), date(2026, 2, 28))

    def test_first_occurrence_handles_month_and_year_rollover(self):
        self.assertEqual(
            first_commitment_occurrence(date(2026, 8, 20), "monthly", "fixed_day", 15, None, None),
            date(2026, 9, 15),
        )
        self.assertEqual(
            first_commitment_occurrence(date(2026, 9, 6), "yearly", "fixed_day", 5, 9, None),
            date(2027, 9, 5),
        )

    def test_business_day_occurrence_counts_monday_to_saturday(self):
        self.assertEqual(
            first_commitment_occurrence(date(2026, 8, 1), "monthly", "business_day", None, None, 5),
            date(2026, 8, 6),
        )

    def test_monthly_projection_and_advance_use_the_same_day(self):
        row = {
            "id": uuid4(),
            "commitment_type": "recurring",
            "frequency": "monthly",
            "due_rule": "fixed_day",
            "due_day": 31,
            "due_month": None,
            "starts_on": date(2026, 1, 1),
            "next_due_on": date(2026, 1, 31),
            "ends_on": None,
        }
        self.assertEqual(projected_commitment_date(row, 2026, 2), date(2026, 2, 28))
        self.assertEqual(next_projected_commitment_date(row, date(2026, 2, 1)), date(2026, 2, 28))
        self.assertEqual(next_commitment_due_date(row), date(2026, 2, 28))

    def test_yearly_projection_respects_due_month_and_end_date(self):
        row = {
            "commitment_type": "recurring",
            "frequency": "yearly",
            "due_rule": "fixed_day",
            "due_day": 5,
            "due_month": 9,
            "starts_on": date(2026, 9, 1),
            "next_due_on": date(2026, 9, 5),
            "ends_on": date(2027, 9, 4),
        }
        self.assertIsNone(projected_commitment_date(row, 2027, 8))
        self.assertIsNone(projected_commitment_date(row, 2027, 9))

    def test_installment_projection_advances_progress_without_recording(self):
        row = {
            "commitment_type": "installment",
            "frequency": "monthly",
            "due_rule": "fixed_day",
            "due_day": 10,
            "due_month": None,
            "starts_on": date(2026, 9, 10),
            "next_due_on": date(2026, 9, 10),
            "ends_on": None,
            "current_installment": 1,
            "total_installments": 4,
        }
        self.assertEqual(projected_commitment_date(row, 2026, 10), date(2026, 10, 10))
        from apps.backend.app.domain.commitments import projected_installment_number

        self.assertEqual(projected_installment_number(row, 2026, 10), 2)
        self.assertIsNone(projected_commitment_date(row, 2027, 1))

    def test_allocation_supports_percentage_fixed_and_overage(self):
        percentage = calculate_allocation(
            Decimal("2000.00"), BudgetAllocationMode.PERCENTAGE, Decimal("50"), None, Decimal("200.00")
        )
        self.assertEqual(percentage["target_amount"], Decimal("1000.00"))
        self.assertEqual(percentage["remaining_amount"], Decimal("800.00"))

        fixed = calculate_allocation(
            Decimal("1000.00"), BudgetAllocationMode.FIXED_AMOUNT, None, Decimal("700.00")
        )
        self.assertEqual(fixed["target_amount"], Decimal("700.00"))
        self.assertEqual(fixed["percentage"], Decimal("70.00"))

        overage = calculate_allocation(
            Decimal("2000.00"), BudgetAllocationMode.FIXED_AMOUNT, None, Decimal("2500.00")
        )
        self.assertEqual(overage["remaining_amount"], Decimal("2500.00"))


class FakeResult:
    def __init__(self, row=None, rows=None):
        self.row = row
        self.rows = rows or []

    def fetchone(self):
        return self.row

    def fetchall(self):
        return self.rows


class FakeConnection:
    def __init__(self, commitments, existing_transaction=False):
        self.commitments = commitments
        self.existing_transaction = existing_transaction
        self.inserted = []
        self.updated = []

    def execute(self, query, params=None):
        normalized = " ".join(query.split()).lower()
        if "from public.commitments c" in normalized and normalized.startswith("select"):
            return FakeResult(rows=self.commitments)
        if "from public.transactions" in normalized and normalized.startswith("select"):
            return FakeResult(row={"id": uuid4()} if self.existing_transaction else None)
        if normalized.startswith("insert into public.transactions"):
            self.inserted.append(params)
            return FakeResult()
        if normalized.startswith("update public.commitments"):
            self.updated.append(params)
            for commitment in self.commitments:
                if commitment["id"] == params[3]:
                    commitment["next_due_on"] = params[0]
                    commitment["current_installment"] = params[1]
                    commitment["is_active"] = params[2]
            return FakeResult()
        raise AssertionError(f"Unexpected query: {query}")


def commitment_row(**overrides):
    row = {
        "id": uuid4(),
        "user_id": uuid4(),
        "category_id": None,
        "name": "Salário",
        "commitment_type": "recurring",
        "direction": "income",
        "amount": Decimal("2000.00"),
        "frequency": "monthly",
        "due_rule": "fixed_day",
        "due_day": 5,
        "due_month": None,
        "business_day_number": None,
        "starts_on": date(2026, 1, 1),
        "next_due_on": date(2026, 9, 5),
        "ends_on": None,
        "total_installments": None,
        "current_installment": None,
        "is_active": True,
        "created_at": None,
        "auto_confirm_income": True,
    }
    row.update(overrides)
    return row


class CommitmentProcessorTests(unittest.TestCase):
    def test_due_commitment_is_created_once_and_advanced(self):
        connection = FakeConnection([commitment_row()])
        processed = process_due_commitments(connection, date(2026, 9, 5))

        self.assertEqual(processed, 1)
        self.assertEqual(len(connection.inserted), 1)
        self.assertEqual(connection.inserted[0][7], "completed")
        self.assertEqual(connection.updated[0][0], date(2026, 10, 5))

    def test_duplicate_occurrence_is_not_inserted_or_advanced(self):
        connection = FakeConnection([commitment_row()], existing_transaction=True)
        processed = process_due_commitments(connection, date(2026, 9, 5))

        self.assertEqual(processed, 0)
        self.assertEqual(connection.inserted, [])
        self.assertEqual(connection.updated, [])

    def test_last_installment_is_created_and_deactivated(self):
        connection = FakeConnection(
            [
                commitment_row(
                    commitment_type="installment",
                    name="Notebook",
                    direction="expense",
                    amount=Decimal("300.00"),
                    total_installments=1,
                    current_installment=1,
                )
            ]
        )
        processed = process_due_commitments(connection, date(2026, 9, 5))

        self.assertEqual(processed, 1)
        self.assertEqual(len(connection.inserted), 1)
        self.assertFalse(connection.updated[0][2])


if __name__ == "__main__":
    unittest.main()
