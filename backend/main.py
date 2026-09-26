import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

import models
import settings
from catalog import lab_runtimes
from database import Base, engine
from routers import documents, finance, lab, studio
from store import get_store
from version import APP_VERSION

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="FocusStack API",
    description=(
        "Writing studio API for blog ideas, mind maps, personal essays, "
        "personal finances, templates, a writing playlist, and a light code lab.\n\n"
        "Set DATABASE_URL or POSTGRES_HOST to use PostgreSQL (recommended). "
        "SQLite is used only when no Postgres URL is configured."
    ),
    version=APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=[
        {"name": "studio", "description": "Health, stats, templates, playlist"},
        {"name": "documents", "description": "Pages, essays, maps, money stories"},
        {"name": "finance", "description": "Ledger entries and summaries"},
        {"name": "lab", "description": "Snippets and code execution"},
    ],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def attach_request_id(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
    response = await call_next(request)
    response.headers["x-request-id"] = request_id
    return response


app.include_router(studio.router)
app.include_router(documents.router)
app.include_router(finance.router)
app.include_router(lab.router)


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")


@app.get("/api/health", response_model=None, tags=["studio"])
def health():
    store_ok = True
    try:
        store_ok = bool(get_store().ping())
    except Exception:
        store_ok = False
    return {
        "status": "ok" if store_ok else "degraded",
        "service": "FocusStack",
        "version": APP_VERSION,
        "database": settings.database_backend(),
        "dataset": settings.database_label(),
        "store_ok": store_ok,
        "lab": lab_runtimes(),
    }
