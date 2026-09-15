from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

Role = Literal[
    "administrator", "platform_engineer", "analyst", "developer", "finance", "viewer", "support"
]


class Principal(BaseModel):
    user_id: str
    name: str
    email: str = ""
    tenant_id: str
    organization: str = ""
    role: Role
    job_title: str = ""
    department: str = ""
    active: bool = True


class InvestigationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question: str = Field(
        default="Investigate product revenue, customer complaints and warranty evidence.",
        min_length=10,
        max_length=500,
    )
    decline_threshold: float = Field(default=15, ge=0, le=100, allow_inf_nan=False)
    as_of: str = "2026-07-01"
    region: Literal["All regions", "West", "South", "North"] = "All regions"

    @field_validator("as_of")
    @classmethod
    def valid_date(cls, value: str) -> str:
        parsed = date.fromisoformat(value)
        if not 2000 <= parsed.year <= 2100:
            raise ValueError("Choose a date between 2000 and 2100")
        return parsed.isoformat()


class Complaint(BaseModel):
    category: str
    count: int


class Evidence(BaseModel):
    id: str
    kind: Literal["sql", "document", "calculation"]
    title: str
    excerpt: str
    source: str


class ProductFinding(BaseModel):
    product_id: str
    product: str
    previous_revenue: float
    current_revenue: float
    change_pct: float
    complaints: list[Complaint]
    warranty: str
    evidence_ids: list[str]


class TraceStep(BaseModel):
    name: str
    status: Literal["complete", "blocked", "skipped", "running", "failed"]
    detail: str
    duration_ms: float


class Investigation(BaseModel):
    id: str
    mode: str = "local"
    currency: Literal["INR"] = "INR"
    status: Literal["complete", "insufficient_evidence"]
    question: str
    period: str
    region: str = "All regions"
    summary: str
    recommendations: list[str]
    products: list[ProductFinding]
    evidence: list[Evidence]
    trace: list[TraceStep]
    duration_ms: float
    created_at: str
