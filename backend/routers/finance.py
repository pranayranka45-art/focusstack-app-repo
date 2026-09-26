from fastapi import APIRouter, HTTPException, Query

import schemas
from store import get_store

router = APIRouter(prefix="/api/finance", tags=["finance"])


def _summary(rows: list[dict]) -> dict:
    income = sum(f["amount"] for f in rows if f["kind"] == "income")
    expense = sum(f["amount"] for f in rows if f["kind"] == "expense")
    buckets: dict[str, float] = {}
    for row in rows:
        sign = 1 if row["kind"] == "income" else -1
        buckets[row["category"]] = buckets.get(row["category"], 0) + sign * row["amount"]
    by_category = [
        {"category": name, "net": round(total, 2)}
        for name, total in sorted(buckets.items(), key=lambda kv: abs(kv[1]), reverse=True)
    ]
    return {
        "income_total": round(income, 2),
        "expense_total": round(expense, 2),
        "net": round(income - expense, 2),
        "entry_count": len(rows),
        "by_category": by_category,
    }


@router.get("", response_model=list[schemas.FinanceOut])
def list_entries(
    kind: schemas.FinanceKind | None = None,
    category: str | None = Query(default=None, max_length=80),
    from_date: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    to_date: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
):
    return get_store().list_finance(
        kind=kind.value if kind else None,
        category=category,
        from_date=from_date,
        to_date=to_date,
    )


@router.get("/summary", response_model=schemas.FinanceSummary)
def summary(
    kind: schemas.FinanceKind | None = None,
    category: str | None = Query(default=None, max_length=80),
    from_date: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    to_date: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
):
    return _summary(
        get_store().list_finance(
            kind=kind.value if kind else None,
            category=category,
            from_date=from_date,
            to_date=to_date,
        )
    )


@router.get("/{entry_id}", response_model=schemas.FinanceOut)
def get_entry(entry_id: str):
    row = get_store().get_finance(entry_id)
    if not row:
        raise HTTPException(status_code=404, detail="Entry not found")
    return row


@router.post("", response_model=schemas.FinanceOut, status_code=201)
def create_entry(payload: schemas.FinanceCreate):
    return get_store().create_finance(payload.model_dump(mode="json"))


@router.patch("/{entry_id}", response_model=schemas.FinanceOut)
def update_entry(entry_id: str, payload: schemas.FinanceUpdate):
    row = get_store().update_finance(entry_id, payload.model_dump(exclude_unset=True, mode="json"))
    if not row:
        raise HTTPException(status_code=404, detail="Entry not found")
    return row


@router.delete("/{entry_id}", status_code=204)
def delete_entry(entry_id: str):
    if not get_store().delete_finance(entry_id):
        raise HTTPException(status_code=404, detail="Entry not found")
