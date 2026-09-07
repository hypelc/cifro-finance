from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class CategoryKind(StrEnum):
    INCOME = "income"
    EXPENSE = "expense"
    BOTH = "both"


class Direction(StrEnum):
    INCOME = "income"
    EXPENSE = "expense"


class TransactionStatus(StrEnum):
    COMPLETED = "completed"
    PLANNED = "planned"


class CommitmentType(StrEnum):
    SUBSCRIPTION = "subscription"
    INSTALLMENT = "installment"
    RECURRING = "recurring"


class CommitmentFrequency(StrEnum):
    MONTHLY = "monthly"
    YEARLY = "yearly"


class CommitmentDueRule(StrEnum):
    FIXED_DAY = "fixed_day"
    BUSINESS_DAY = "business_day"


class BudgetBaseMode(StrEnum):
    TOTAL_INCOME = "total_income"
    CATEGORY_INCOME = "category_income"
    MANUAL = "manual"


class BudgetAllocationMode(StrEnum):
    PERCENTAGE = "percentage"
    FIXED_AMOUNT = "fixed_amount"


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    kind: CategoryKind


class CategoryUpdate(CategoryCreate):
    pass


class CategoryRead(CategoryCreate):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    is_active: bool
    created_at: datetime


class SimulationSource(StrEnum):
    MANUAL = "manual"
    PLANNING = "planning"


class SimulationCreate(BaseModel):
    name: str = Field(default="Nova simulação", min_length=1, max_length=120)
    reference: str | None = Field(default=None, max_length=120)
    period_year: int | None = Field(default=None, ge=2000, le=2100)
    period_month: int | None = Field(default=None, ge=1, le=12)

    @field_validator("name")
    @classmethod
    def normalize_simulation_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Text must contain at least one non-space character")
        return normalized

    @field_validator("reference")
    @classmethod
    def normalize_simulation_reference(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None

    @model_validator(mode="after")
    def validate_period(self):
        if (self.period_year is None) != (self.period_month is None):
            raise ValueError("Simulation period requires both period_year and period_month")
        return self


class SimulationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    reference: str | None = Field(default=None, max_length=120)
    period_year: int | None = Field(default=None, ge=2000, le=2100)
    period_month: int | None = Field(default=None, ge=1, le=12)

    @field_validator("name", "reference")
    @classmethod
    def normalize_simulation_update_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("Text must contain at least one non-space character")
        return normalized

    @model_validator(mode="after")
    def validate_period(self):
        if (self.period_year is None) != (self.period_month is None):
            raise ValueError("Simulation period requires both period_year and period_month")
        return self


class SimulationItemCreate(BaseModel):
    description: str = Field(min_length=1, max_length=160)
    direction: Direction
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    category_id: UUID | None = None
    source: SimulationSource = SimulationSource.MANUAL

    @field_validator("description")
    @classmethod
    def normalize_simulation_description(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Description must contain at least one non-space character")
        return normalized


class SimulationItemUpdate(BaseModel):
    description: str | None = Field(default=None, min_length=1, max_length=160)
    direction: Direction | None = None
    amount: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    category_id: UUID | None = None

    @field_validator("description")
    @classmethod
    def normalize_simulation_update_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("Description must contain at least one non-space character")
        return normalized


class SimulationMove(BaseModel):
    direction: Literal["up", "down"]


class SimulationPlanningImport(BaseModel):
    commitment_ids: list[UUID] = Field(min_length=1, max_length=50)


class SimulationCategoryTotal(BaseModel):
    category_id: UUID | None = None
    category_name: str
    amount: Decimal


class SimulationTotals(BaseModel):
    total_income: Decimal
    total_expenses: Decimal
    final_balance: Decimal
    expenses_by_category: list[SimulationCategoryTotal]


class SimulationItemRead(SimulationItemCreate):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    simulation_id: UUID
    position: int
    category_name: str | None = None
    planning_commitment_id: UUID | None = None
    planning_occurrence_on: date | None = None
    created_at: datetime
    updated_at: datetime


class SimulationSummaryRead(SimulationCreate):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    item_count: int
    total_income: Decimal
    total_expenses: Decimal
    final_balance: Decimal
    created_at: datetime
    updated_at: datetime


class SimulationRead(SimulationSummaryRead):
    items: list[SimulationItemRead]
    totals: SimulationTotals


class SimulationPlanningOptionRead(BaseModel):
    id: UUID
    name: str
    amount: Decimal
    direction: Direction
    next_due_on: date
    category_id: UUID | None = None
    category_name: str | None = None


class TransactionCreate(BaseModel):
    description: str = Field(min_length=1, max_length=160)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    direction: Direction
    occurred_on: date
    category_id: UUID | None = None
    commitment_id: UUID | None = None
    status: TransactionStatus = TransactionStatus.COMPLETED
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Description must contain at least one non-space character")
        return normalized


class TransactionUpdate(BaseModel):
    description: str | None = Field(default=None, min_length=1, max_length=160)
    amount: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    direction: Direction | None = None
    occurred_on: date | None = None
    category_id: UUID | None = None
    commitment_id: UUID | None = None
    status: TransactionStatus | None = None
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("Description must contain at least one non-space character")
        return normalized


class TransactionRead(TransactionCreate):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime
    category_name: str | None = None
    commitment_name: str | None = None


class CommitmentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    commitment_type: CommitmentType
    direction: Direction
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    frequency: CommitmentFrequency
    due_rule: CommitmentDueRule = CommitmentDueRule.FIXED_DAY
    due_day: int | None = Field(default=None, gt=0, le=31)
    due_month: int | None = Field(default=None, gt=0, le=12)
    business_day_number: int | None = Field(default=None, gt=0, le=31)
    starts_on: date
    next_due_on: date | None = None
    ends_on: date | None = None
    category_id: UUID | None = None
    total_installments: int | None = Field(default=None, gt=0)
    current_installment: int | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def validate_commitment(self):
        if self.due_rule == CommitmentDueRule.FIXED_DAY and self.due_day is None and self.next_due_on is None:
            raise ValueError("Fixed-day commitments require due_day or next_due_on")
        if self.next_due_on and self.next_due_on < self.starts_on:
            raise ValueError("next_due_on must be on or after starts_on")
        if self.ends_on and self.ends_on < self.starts_on:
            raise ValueError("ends_on must be on or after starts_on")

        if self.due_rule == CommitmentDueRule.BUSINESS_DAY:
            if self.business_day_number is None:
                raise ValueError("Business-day commitments require business_day_number")
            if self.due_day is not None:
                raise ValueError("Business-day commitments cannot have due_day")
        elif self.business_day_number is not None:
            raise ValueError("Only business-day commitments can have business_day_number")
        elif self.due_day is None and self.next_due_on is not None:
            self.due_day = self.next_due_on.day

        if self.frequency == CommitmentFrequency.YEARLY:
            if self.due_month is None and self.next_due_on is not None:
                self.due_month = self.next_due_on.month
            if self.due_month is None:
                raise ValueError("Yearly commitments require due_month or next_due_on")
        elif self.due_month is not None:
            raise ValueError("Only yearly commitments can have due_month")

        is_installment = self.commitment_type == CommitmentType.INSTALLMENT
        if is_installment:
            if self.total_installments is None or self.current_installment is None:
                raise ValueError("Installments require total_installments and current_installment")
            if self.current_installment > self.total_installments:
                raise ValueError("current_installment cannot exceed total_installments")
        elif self.total_installments is not None or self.current_installment is not None:
            raise ValueError("Only installments can have installment counts")

        return self


class CommitmentUpdate(CommitmentCreate):
    pass


class CommitmentRead(CommitmentCreate):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    is_active: bool
    created_at: datetime
    category_name: str | None = None


class CommitmentRecordCreate(BaseModel):
    occurred_on: date | None = None


class CommitmentRecordResult(BaseModel):
    transaction: TransactionRead
    commitment: CommitmentRead


class UserSettingsRead(BaseModel):
    auto_confirm_income: bool
    default_due_rule: CommitmentDueRule
    default_business_day_number: int
    opening_year: int | None = Field(default=None, ge=2000, le=2100)
    opening_month: int | None = Field(default=None, ge=1, le=12)
    opening_balance: Decimal | None = Field(default=None, max_digits=12, decimal_places=2)
    updated_at: datetime


class UserSettingsUpdate(BaseModel):
    auto_confirm_income: bool
    default_due_rule: CommitmentDueRule
    default_business_day_number: int = Field(gt=0, le=31)
    opening_year: int | None = Field(default=None, ge=2000, le=2100)
    opening_month: int | None = Field(default=None, ge=1, le=12)
    opening_balance: Decimal | None = Field(default=None, max_digits=12, decimal_places=2)

    @model_validator(mode="after")
    def validate_opening_balance(self):
        values = (self.opening_year, self.opening_month, self.opening_balance)
        if any(value is not None for value in values) and not all(value is not None for value in values):
            raise ValueError("Opening balance requires year, month and amount")
        return self


class BudgetSettingsUpdate(BaseModel):
    base_mode: BudgetBaseMode
    income_category_id: UUID | None = None
    manual_amount: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)

    @model_validator(mode="after")
    def validate_base(self):
        if self.base_mode == BudgetBaseMode.CATEGORY_INCOME:
            if self.income_category_id is None or self.manual_amount is not None:
                raise ValueError("Category income requires only income_category_id")
        elif self.base_mode == BudgetBaseMode.MANUAL:
            if self.manual_amount is None or self.income_category_id is not None:
                raise ValueError("Manual base requires only manual_amount")
        elif self.income_category_id is not None or self.manual_amount is not None:
            raise ValueError("Total income does not accept a category or manual amount")
        return self


class BudgetSettingsRead(BudgetSettingsUpdate):
    income_category_name: str | None = None
    updated_at: datetime


class BudgetAllocationUpdate(BaseModel):
    allocation_mode: BudgetAllocationMode
    percentage: Decimal | None = Field(default=None, gt=0, le=100, max_digits=5, decimal_places=2)
    fixed_amount: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)

    @model_validator(mode="after")
    def validate_allocation(self):
        if self.allocation_mode == BudgetAllocationMode.PERCENTAGE:
            if self.percentage is None or self.fixed_amount is not None:
                raise ValueError("Percentage allocations require only percentage")
        elif self.fixed_amount is None or self.percentage is not None:
            raise ValueError("Fixed allocations require only fixed_amount")
        return self


class BudgetAllocationRead(BaseModel):
    category_id: UUID
    category_name: str
    allocation_mode: BudgetAllocationMode
    percentage: Decimal
    fixed_amount: Decimal | None = None
    target_amount: Decimal
    actual_amount: Decimal
    remaining_amount: Decimal


class BudgetSummaryRead(BaseModel):
    month: str
    settings: BudgetSettingsRead
    base_amount: Decimal
    allocated_amount: Decimal
    total_percentage: Decimal
    unallocated_percentage: Decimal
    unallocated_amount: Decimal
    allocations: list[BudgetAllocationRead]


class BudgetDashboardRead(BaseModel):
    base_amount: Decimal
    allocated_amount: Decimal
    total_percentage: Decimal
    unallocated_percentage: Decimal
    unallocated_amount: Decimal
    allocation_count: int


class DashboardPeriod(BaseModel):
    opening_balance: Decimal
    income: Decimal
    expenses: Decimal
    net_result: Decimal
    ending_balance: Decimal
    available: Decimal


class CommitmentPreview(BaseModel):
    id: UUID
    name: str
    amount: Decimal
    direction: Direction
    commitment_type: str
    next_due_on: date
    category_name: str | None = None
    installment_number: int | None = None
    total_installments: int | None = None


class DashboardRead(BaseModel):
    month: str
    next_month: str
    current: DashboardPeriod
    next_month_summary: DashboardPeriod
    next_month_commitments: list[CommitmentPreview]
    recent_transactions: list[TransactionRead]
    budget: BudgetDashboardRead | None = None
    balance_anchor: str | None = None
