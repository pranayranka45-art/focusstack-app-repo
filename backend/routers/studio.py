from fastapi import APIRouter, HTTPException

import schemas
from catalog import PLAYLIST_TRACKS
from store import get_store
from version import APP_VERSION
from writing_templates import TEMPLATES

router = APIRouter(prefix="/api", tags=["studio"])


@router.get("", response_model=schemas.ApiIndex)
def index():
    return {
        "service": "FocusStack",
        "version": APP_VERSION,
        "docs": "/docs",
        "endpoints": {
            "health": "/api/health",
            "stats": "/api/dashboard/stats",
            "documents": "/api/documents",
            "templates": "/api/templates",
            "finance": "/api/finance",
            "finance_summary": "/api/finance/summary",
            "lab": "/api/lab/run",
            "snippets": "/api/lab/snippets",
            "playlist": "/api/playlist/tracks",
            "export": "/api/documents/{id}/export",
            "duplicate": "/api/documents/{id}/duplicate",
        },
    }


@router.get("/dashboard/stats", response_model=schemas.DashboardStats)
def stats():
    return get_store().stats()


@router.get("/templates", response_model=list[schemas.TemplateOut])
def templates(doc_type: schemas.DocType | None = None):
    if doc_type:
        return [t for t in TEMPLATES if t["doc_type"] == doc_type.value]
    return TEMPLATES


@router.get("/templates/{template_id}", response_model=schemas.TemplateOut)
def get_template(template_id: str):
    tmpl = next((t for t in TEMPLATES if t["id"] == template_id), None)
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return tmpl


@router.get("/playlist/tracks", response_model=list[schemas.PlaylistTrack])
def playlist_tracks():
    return PLAYLIST_TRACKS
