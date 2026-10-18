from fastapi import APIRouter, Depends, HTTPException

import schemas
from auth import require_user
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
def stats(user: dict = Depends(require_user)):
    return get_store().stats(user["id"])


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


@router.get("/playlist/saved", response_model=list[schemas.TrackOut])
def saved_tracks(user: dict = Depends(require_user)):
    return get_store().list_tracks(user["id"])


@router.post("/playlist/saved", response_model=schemas.TrackOut, status_code=201)
def save_track(payload: schemas.TrackCreate, user: dict = Depends(require_user)):
    if len(get_store().list_tracks(user["id"])) >= 100:
        raise HTTPException(status_code=400, detail="Playlist is full (100 tracks).")
    return get_store().create_track(user["id"], payload.model_dump())


@router.delete("/playlist/saved/{track_id}", status_code=204)
def remove_track(track_id: str, user: dict = Depends(require_user)):
    if not get_store().delete_track(user["id"], track_id):
        raise HTTPException(status_code=404, detail="Track not found")
