from calendar import monthrange
from datetime import date

from .calendar import business_day_date, first_business_occurrence, month_bounds, next_month


def fixed_commitment_date(year: int, month: int, due_day: int) -> date:
    """Return a fixed billing day, clamped in shorter months."""
    return date(year, month, min(due_day, monthrange(year, month)[1]))


def commitment_due_day(row: dict) -> int:
    """Read the explicit billing day, with a safe fallback for old rows."""
    return row.get("due_day") or row["next_due_on"].day


def commitment_due_month(row: dict) -> int:
    """Read the explicit yearly billing month, with a legacy fallback."""
    return row.get("due_month") or row["next_due_on"].month


def first_fixed_occurrence(
    start: date,
    frequency: str,
    due_day: int,
    due_month: int | None = None,
) -> date:
    if frequency == "monthly":
        candidate = fixed_commitment_date(start.year, start.month, due_day)
        if candidate < start:
            year, month = next_month(start.year, start.month)
            return fixed_commitment_date(year, month, due_day)
        return candidate

    candidate = fixed_commitment_date(start.year, due_month or start.month, due_day)
    if candidate < start:
        candidate = fixed_commitment_date(start.year + 1, due_month or start.month, due_day)
    return candidate


def first_commitment_occurrence(
    start: date,
    frequency: str,
    due_rule: str,
    due_day: int | None,
    due_month: int | None,
    business_day_number: int | None,
) -> date | None:
    if due_rule == "business_day":
        if frequency == "monthly":
            return first_business_occurrence(start, business_day_number)
        candidate = business_day_date(start.year, due_month or start.month, business_day_number)
        if candidate and candidate < start:
            candidate = business_day_date(start.year + 1, due_month or start.month, business_day_number)
        return candidate
    return first_fixed_occurrence(start, frequency, due_day, due_month)


def projected_commitment_date(row: dict, year: int, month: int) -> date | None:
    """Return the occurrence of a commitment inside the requested month."""
    projection = projected_commitment(row, year, month)
    return projection[0] if projection else None


def projected_installment_number(row: dict, year: int, month: int) -> int | None:
    """Return the installment number projected for a month, when applicable."""
    projection = projected_commitment(row, year, month)
    return projection[1] if projection else None


def projected_commitment(row: dict, year: int, month: int) -> tuple[date, int | None] | None:
    """Return an occurrence and its installment number for a requested month."""
    baseline = row["next_due_on"]
    target_start, _ = month_bounds(year, month)
    baseline_start, _ = month_bounds(baseline.year, baseline.month)
    if target_start < baseline_start:
        return None

    if row["commitment_type"] == "installment":
        if row["frequency"] == "yearly":
            if month != commitment_due_month(row):
                return None
            periods = year - baseline.year
        else:
            periods = (year - baseline.year) * 12 + month - baseline.month
        installment_number = (row.get("current_installment") or 1) + periods
        total_installments = row.get("total_installments")
        if periods < 0 or not total_installments or installment_number > total_installments:
            return None
        if row["due_rule"] == "business_day":
            projected = business_day_date(year, month, row["business_day_number"])
        else:
            projected = fixed_commitment_date(year, month, commitment_due_day(row))
        if projected is None or projected < row["starts_on"]:
            return None
        if row["ends_on"] and projected > row["ends_on"]:
            return None
        return projected, installment_number

    if row["frequency"] == "monthly":
        if row["due_rule"] == "business_day":
            projected = business_day_date(year, month, row["business_day_number"])
        else:
            projected = fixed_commitment_date(year, month, commitment_due_day(row))
    elif row["frequency"] == "yearly":
        if commitment_due_month(row) != month:
            return None
        if row["due_rule"] == "business_day":
            projected = business_day_date(year, month, row["business_day_number"])
        else:
            projected = fixed_commitment_date(year, month, commitment_due_day(row))
    else:
        return None

    if projected is None or projected < row["starts_on"]:
        return None
    if row["ends_on"] and projected > row["ends_on"]:
        return None
    return projected, None


def next_projected_commitment_date(row: dict, from_date: date) -> date | None:
    """Find the next visible occurrence without creating future transactions."""
    if row["commitment_type"] == "installment":
        return row["next_due_on"] if row["next_due_on"] >= from_date else None

    year, month = from_date.year, from_date.month
    for _ in range(120):
        projected = projected_commitment_date(row, year, month)
        if projected and projected >= from_date:
            return projected
        year, month = next_month(year, month)
    return None


def next_commitment_due_date(row: dict) -> date | None:
    """Advance a commitment one occurrence after its stored due date."""
    current = row["next_due_on"]
    if row["frequency"] == "monthly":
        year, month = next_month(current.year, current.month)
        if row["due_rule"] == "business_day":
            return business_day_date(year, month, row["business_day_number"])
        return fixed_commitment_date(year, month, commitment_due_day(row))

    if row["frequency"] == "yearly":
        year = current.year + 1
        if row["due_rule"] == "business_day":
            return business_day_date(year, commitment_due_month(row), row["business_day_number"])
        return fixed_commitment_date(year, commitment_due_month(row), commitment_due_day(row))

    return None
