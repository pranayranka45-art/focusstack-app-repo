from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse, PlainTextResponse

import schemas
from store import get_store
from writing_templates import TEMPLATES

router = APIRouter(prefix="/api/documents", tags=["documents"])


def _slug(title: str) -> str:
    cleaned = "".join(ch.lower() if ch.isalnum() else "-" for ch in title).strip("-")
    while "--" in cleaned:
        cleaned = cleaned.replace("--", "-")
    return (cleaned or "page")[:60]


@router.get("", response_model=list[schemas.DocumentOut])
def list_documents(
    doc_type: schemas.DocType | None = None,
    q: str | None = Query(default=None, max_length=200),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    return get_store().list_documents(
        doc_type=doc_type.value if doc_type else None,
        q=q,
        limit=limit,
        offset=offset,
    )


@router.post("/from-template/{template_id}", response_model=schemas.DocumentOut, status_code=201)
def create_from_template(template_id: str, title: str | None = Query(default=None, max_length=200)):
    tmpl = next((t for t in TEMPLATES if t["id"] == template_id), None)
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    heading = (title or tmpl["title"]).strip()
    content = tmpl["content"].replace("{title}", heading)
    return get_store().create_document(
        {
            "title": heading,
            "content": content,
            "doc_type": tmpl["doc_type"],
            "language": "json" if tmpl["doc_type"] == "mindmap" else "markdown",
        }
    )


@router.post("/{doc_id}/duplicate", response_model=schemas.DocumentOut, status_code=201)
def duplicate_document(doc_id: str):
    doc = get_store().get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return get_store().create_document(
        {
            "title": f"{doc['title']} (copy)",
            "content": doc["content"],
            "doc_type": doc["doc_type"],
            "language": doc["language"],
        }
    )


@router.get("/{doc_id}/export")
def export_document(doc_id: str, format: str = Query(default="markdown", pattern="^(markdown|json)$")):
    doc = get_store().get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if format == "json":
        payload = dict(doc)
        for key in ("created_at", "updated_at"):
            value = payload.get(key)
            if hasattr(value, "isoformat"):
                payload[key] = value.isoformat()
        return JSONResponse(payload)
    body = f"# {doc['title']}\n\n{doc['content']}"
    filename = f"{_slug(doc['title'])}.md"
    return PlainTextResponse(
        body,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{doc_id}", response_model=schemas.DocumentOut)
def get_document(doc_id: str):
    doc = get_store().get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.post("", response_model=schemas.DocumentOut, status_code=201)
def create_document(payload: schemas.DocumentCreate):
    return get_store().create_document(payload.model_dump(mode="json"))


@router.patch("/{doc_id}", response_model=schemas.DocumentOut)
def update_document(doc_id: str, payload: schemas.DocumentUpdate):
    doc = get_store().update_document(doc_id, payload.model_dump(exclude_unset=True, mode="json"))
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.delete("/{doc_id}", status_code=204)
def delete_document(doc_id: str):
    if not get_store().delete_document(doc_id):
        raise HTTPException(status_code=404, detail="Document not found")
