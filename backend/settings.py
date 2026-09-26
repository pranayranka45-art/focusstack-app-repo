import os
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")
load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def _normalize_db_url(url: str) -> str:
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://") and "+psycopg" not in url.split("://", 1)[0]:
        url = "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


def _build_database_url() -> str:
    explicit = os.getenv("DATABASE_URL") or os.getenv("FOCUSSTACK_DATABASE_URL")
    if explicit:
        return _normalize_db_url(explicit.strip())
    host = os.getenv("POSTGRES_HOST", "").strip()
    if host:
        user = os.getenv("POSTGRES_USER", "focusstack")
        password = os.getenv("POSTGRES_PASSWORD", "focusstack")
        port = os.getenv("POSTGRES_PORT", "5432")
        name = os.getenv("POSTGRES_DB", "focusstack")
        return f"postgresql+psycopg://{user}:{password}@{host}:{port}/{name}"
    return "sqlite:///./focusstack.db"


DATABASE_URL = _build_database_url()
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]


def database_backend() -> str:
    if DATABASE_URL.startswith("sqlite"):
        return "sqlite"
    return "postgresql"


def database_label() -> str:
    if DATABASE_URL.startswith("sqlite"):
        return DATABASE_URL.split("///")[-1] or "focusstack.db"
    parsed = urlparse(DATABASE_URL.replace("postgresql+psycopg://", "postgresql://"))
    db_name = (parsed.path or "/focusstack").lstrip("/")
    host = parsed.hostname or "localhost"
    port = parsed.port or 5432
    return f"{host}:{port}/{db_name}"
