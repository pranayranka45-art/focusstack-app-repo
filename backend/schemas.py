from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, computed_field, field_validator


class DocType(str, Enum):
    blog = "blog"
    essay = "essay"
    mindmap = "mindmap"
    finance = "finance"


class FinanceKind(str, Enum):
    income = "income"
    expense = "expense"


class LabLanguage(str, Enum):
    python = "python"
    javascript = "javascript"
    java = "java"


class DocumentCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(default="", max_length=500_000)
    doc_type: DocType = DocType.blog
    language: str = Field(default="markdown", max_length=30)


class DocumentUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    content: Optional[str] = Field(default=None, max_length=500_000)
    doc_type: Optional[DocType] = None
    language: Optional[str] = Field(default=None, max_length=30)


class DocumentOut(BaseModel):
    id: str
    title: str
    content: str
    doc_type: str
    language: str
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def word_count(self) -> int:
        text = (self.content or "").strip()
        if not text or self.doc_type == "mindmap":
            return 0
        return len(text.split())


class FinanceCreate(BaseModel):
    date: str
    category: str = Field(default="general", min_length=1, max_length=80)
    amount: float = Field(..., ge=0, le=1_000_000_000)
    kind: FinanceKind = FinanceKind.expense
    note: str = Field(default="", max_length=2000)

    @field_validator("date")
    @classmethod
    def valid_date(cls, value: str) -> str:
        datetime.strptime(value, "%Y-%m-%d")
        return value


class FinanceUpdate(BaseModel):
    date: Optional[str] = None
    category: Optional[str] = Field(default=None, min_length=1, max_length=80)
    amount: Optional[float] = Field(default=None, ge=0, le=1_000_000_000)
    kind: Optional[FinanceKind] = None
    note: Optional[str] = Field(default=None, max_length=2000)

    @field_validator("date")
    @classmethod
    def valid_date(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        datetime.strptime(value, "%Y-%m-%d")
        return value


class FinanceOut(BaseModel):
    id: str
    date: str
    category: str
    amount: float
    kind: str
    note: str
    created_at: datetime


class FinanceSummary(BaseModel):
    income_total: float
    expense_total: float
    net: float
    entry_count: int
    by_category: list[dict]


class SnippetCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    language: LabLanguage = LabLanguage.python
    code: str = Field(default="", max_length=80_000)


class SnippetUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    language: Optional[LabLanguage] = None
    code: Optional[str] = Field(default=None, max_length=80_000)
    last_output: Optional[str] = None


class SnippetOut(BaseModel):
    id: str
    title: str
    language: str
    code: str
    last_output: str
    created_at: datetime
    updated_at: datetime


class CodeRunRequest(BaseModel):
    language: LabLanguage
    code: str = Field(..., min_length=1, max_length=80_000)


class CodeRunResult(BaseModel):
    language: str
    stdout: str
    stderr: str
    exit_code: int
    timed_out: bool


class LabLanguageInfo(BaseModel):
    id: str
    label: str
    available: bool
    hint: str


class DashboardStats(BaseModel):
    backend: str
    documents_total: int
    blogs: int
    essays: int
    mindmaps: int
    finance_notes: int
    snippets: int
    words_total: int
    income_total: float
    expense_total: float
    net: float


class TemplateOut(BaseModel):
    id: str
    title: str
    doc_type: str
    blurb: str
    content: str


class PlaylistTrack(BaseModel):
    id: str
    title: str
    artist: str
    hint: str


class HealthOut(BaseModel):
    status: str
    service: str
    version: str
    database: str
    dataset: str
    store_ok: bool
    lab: list[LabLanguageInfo]


class ApiIndex(BaseModel):
    service: str
    version: str
    docs: str
    endpoints: dict[str, str]
