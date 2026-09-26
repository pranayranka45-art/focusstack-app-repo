import os
import tempfile
from pathlib import Path

tmp = Path(tempfile.mkdtemp()) / "focusstack-test.db"
os.environ["FOCUSSTACK_DATABASE_URL"] = "sqlite:///" + tmp.as_posix()
os.environ.pop("DATABASE_URL", None)
os.environ.pop("POSTGRES_HOST", None)
os.environ.pop("USE_BIGQUERY", None)

from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402

client = TestClient(app)


def test_health_and_index():
    health = client.get("/api/health")
    assert health.status_code == 200
    body = health.json()
    assert body["service"] == "FocusStack"
    assert body["database"] in {"sqlite", "postgresql"}
    assert body["store_ok"] is True
    assert "x-request-id" in health.headers

    index = client.get("/api")
    assert index.status_code == 200
    assert index.json()["service"] == "FocusStack"


def test_document_crud_duplicate_and_export():
    created = client.post(
        "/api/documents",
        json={"title": "Night notes", "content": "one two three", "doc_type": "essay"},
    )
    assert created.status_code == 201
    doc_id = created.json()["id"]
    assert created.json()["word_count"] == 3

    listed = client.get("/api/documents", params={"q": "Night"})
    assert listed.status_code == 200
    assert any(item["id"] == doc_id for item in listed.json())

    copy = client.post(f"/api/documents/{doc_id}/duplicate")
    assert copy.status_code == 201
    assert copy.json()["title"] == "Night notes (copy)"
    assert copy.json()["id"] != doc_id

    exported = client.get(f"/api/documents/{doc_id}/export")
    assert exported.status_code == 200
    assert exported.text.startswith("# Night notes")

    missing = client.get("/api/documents/not-a-real-id")
    assert missing.status_code == 404


def test_template_and_playlist():
    templates = client.get("/api/templates", params={"doc_type": "blog"})
    assert templates.status_code == 200
    assert len(templates.json()) >= 1

    tracks = client.get("/api/playlist/tracks")
    assert tracks.status_code == 200
    assert {t["id"] for t in tracks.json()} >= {"lofi", "rain"}


def test_finance_validation_and_summary():
    bad = client.post("/api/finance", json={"date": "nope", "amount": -4})
    assert bad.status_code == 422

    ok = client.post(
        "/api/finance",
        json={"date": "2026-09-10", "amount": 12.5, "kind": "expense", "category": "craft"},
    )
    assert ok.status_code == 201

    summary = client.get("/api/finance/summary")
    assert summary.status_code == 200
    assert summary.json()["expense_total"] >= 12.5


def test_lab_run_python():
    result = client.post(
        "/api/lab/run",
        json={"language": "python", "code": "print(2 + 2)"},
    )
    assert result.status_code == 200
    assert result.json()["stdout"].strip() == "4"
    assert result.json()["timed_out"] is False
