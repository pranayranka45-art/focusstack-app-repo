import uuid
from datetime import datetime

from sqlalchemy import or_
from sqlalchemy.orm import Session

import models
from database import SessionLocal, engine


def _doc(row: models.Document) -> dict:
    return {
        "id": row.id,
        "title": row.title,
        "content": row.content or "",
        "doc_type": row.doc_type,
        "language": row.language,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _fin(row: models.FinanceEntry) -> dict:
    return {
        "id": row.id,
        "date": row.date,
        "category": row.category,
        "amount": row.amount,
        "kind": row.kind,
        "note": row.note or "",
        "created_at": row.created_at,
    }


def _snip(row: models.Snippet) -> dict:
    return {
        "id": row.id,
        "title": row.title,
        "language": row.language,
        "code": row.code or "",
        "last_output": row.last_output or "",
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


class SqlStore:
    def __init__(self):
        self.name = engine.dialect.name

    def _session(self) -> Session:
        return SessionLocal()

    def ping(self) -> bool:
        db = self._session()
        try:
            db.query(models.Document).limit(1).all()
            return True
        except Exception:
            return False
        finally:
            db.close()

    def list_documents(self, doc_type=None, q=None, limit=200, offset=0):
        db = self._session()
        try:
            query = db.query(models.Document)
            if doc_type:
                query = query.filter(models.Document.doc_type == doc_type)
            if q:
                needle = f"%{q.strip()}%"
                query = query.filter(
                    or_(
                        models.Document.title.ilike(needle),
                        models.Document.content.ilike(needle),
                    )
                )
            rows = (
                query.order_by(models.Document.updated_at.desc())
                .offset(offset)
                .limit(limit)
                .all()
            )
            return [_doc(r) for r in rows]
        finally:
            db.close()

    def get_document(self, doc_id: str):
        db = self._session()
        try:
            row = db.query(models.Document).filter(models.Document.id == doc_id).first()
            return _doc(row) if row else None
        finally:
            db.close()

    def create_document(self, data: dict):
        db = self._session()
        try:
            row = models.Document(
                id=str(uuid.uuid4()),
                title=data["title"],
                content=data.get("content") or "",
                doc_type=data.get("doc_type") or "blog",
                language=data.get("language") or "markdown",
            )
            db.add(row)
            db.commit()
            db.refresh(row)
            return _doc(row)
        finally:
            db.close()

    def update_document(self, doc_id: str, data: dict):
        db = self._session()
        try:
            row = db.query(models.Document).filter(models.Document.id == doc_id).first()
            if not row:
                return None
            for key, value in data.items():
                if value is not None:
                    setattr(row, key, value)
            row.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(row)
            return _doc(row)
        finally:
            db.close()

    def delete_document(self, doc_id: str) -> bool:
        db = self._session()
        try:
            row = db.query(models.Document).filter(models.Document.id == doc_id).first()
            if not row:
                return False
            db.delete(row)
            db.commit()
            return True
        finally:
            db.close()

    def list_finance(self, kind=None, category=None, from_date=None, to_date=None):
        db = self._session()
        try:
            query = db.query(models.FinanceEntry)
            if kind:
                query = query.filter(models.FinanceEntry.kind == kind)
            if category:
                query = query.filter(models.FinanceEntry.category == category)
            if from_date:
                query = query.filter(models.FinanceEntry.date >= from_date)
            if to_date:
                query = query.filter(models.FinanceEntry.date <= to_date)
            rows = query.order_by(models.FinanceEntry.date.desc()).all()
            return [_fin(r) for r in rows]
        finally:
            db.close()

    def get_finance(self, entry_id: str):
        db = self._session()
        try:
            row = (
                db.query(models.FinanceEntry)
                .filter(models.FinanceEntry.id == entry_id)
                .first()
            )
            return _fin(row) if row else None
        finally:
            db.close()

    def update_finance(self, entry_id: str, data: dict):
        db = self._session()
        try:
            row = (
                db.query(models.FinanceEntry)
                .filter(models.FinanceEntry.id == entry_id)
                .first()
            )
            if not row:
                return None
            for key, value in data.items():
                if value is not None:
                    setattr(row, key, value)
            db.commit()
            db.refresh(row)
            return _fin(row)
        finally:
            db.close()

    def create_finance(self, data: dict):
        db = self._session()
        try:
            row = models.FinanceEntry(
                id=str(uuid.uuid4()),
                date=data["date"],
                category=data.get("category") or "general",
                amount=float(data["amount"]),
                kind=data.get("kind") or "expense",
                note=data.get("note") or "",
            )
            db.add(row)
            db.commit()
            db.refresh(row)
            return _fin(row)
        finally:
            db.close()

    def delete_finance(self, entry_id: str) -> bool:
        db = self._session()
        try:
            row = (
                db.query(models.FinanceEntry)
                .filter(models.FinanceEntry.id == entry_id)
                .first()
            )
            if not row:
                return False
            db.delete(row)
            db.commit()
            return True
        finally:
            db.close()

    def list_snippets(self):
        db = self._session()
        try:
            rows = (
                db.query(models.Snippet)
                .order_by(models.Snippet.updated_at.desc())
                .all()
            )
            return [_snip(r) for r in rows]
        finally:
            db.close()

    def get_snippet(self, snip_id: str):
        db = self._session()
        try:
            row = db.query(models.Snippet).filter(models.Snippet.id == snip_id).first()
            return _snip(row) if row else None
        finally:
            db.close()

    def create_snippet(self, data: dict):
        db = self._session()
        try:
            row = models.Snippet(
                id=str(uuid.uuid4()),
                title=data["title"],
                language=data.get("language") or "python",
                code=data.get("code") or "",
                last_output="",
            )
            db.add(row)
            db.commit()
            db.refresh(row)
            return _snip(row)
        finally:
            db.close()

    def update_snippet(self, snip_id: str, data: dict):
        db = self._session()
        try:
            row = db.query(models.Snippet).filter(models.Snippet.id == snip_id).first()
            if not row:
                return None
            for key, value in data.items():
                if value is not None:
                    setattr(row, key, value)
            row.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(row)
            return _snip(row)
        finally:
            db.close()

    def delete_snippet(self, snip_id: str) -> bool:
        db = self._session()
        try:
            row = db.query(models.Snippet).filter(models.Snippet.id == snip_id).first()
            if not row:
                return False
            db.delete(row)
            db.commit()
            return True
        finally:
            db.close()

    def stats(self) -> dict:
        docs = self.list_documents()
        finance = self.list_finance()
        snippets = self.list_snippets()
        income = sum(f["amount"] for f in finance if f["kind"] == "income")
        expense = sum(f["amount"] for f in finance if f["kind"] == "expense")
        words_total = sum(
            len((d["content"] or "").split())
            for d in docs
            if d["doc_type"] != "mindmap" and (d["content"] or "").strip()
        )

        def count(t):
            return sum(1 for d in docs if d["doc_type"] == t)

        return {
            "backend": self.name,
            "documents_total": len(docs),
            "blogs": count("blog"),
            "essays": count("essay"),
            "mindmaps": count("mindmap"),
            "finance_notes": count("finance"),
            "snippets": len(snippets),
            "words_total": words_total,
            "income_total": income,
            "expense_total": expense,
            "net": income - expense,
        }


_store = None


def get_store():
    global _store
    if _store is None:
        _store = SqlStore()
    return _store
