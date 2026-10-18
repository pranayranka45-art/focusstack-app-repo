import os
import tempfile
from pathlib import Path

tmp = Path(tempfile.mkdtemp()) / "focusstack-auth-test.db"
os.environ["FOCUSSTACK_DATABASE_URL"] = "sqlite:///" + tmp.as_posix()
for var in ("DATABASE_URL", "POSTGRES_HOST", "GOOGLE_CLIENT_ID", "GITHUB_CLIENT_ID"):
    os.environ.pop(var, None)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402

import auth  # noqa: E402
import migrate  # noqa: E402
import models  # noqa: E402
import settings  # noqa: E402
from database import SessionLocal  # noqa: E402
from main import app  # noqa: E402
from routers import auth as auth_routes  # noqa: E402

PASSWORD = "correct horse"


@pytest.fixture(autouse=True)
def _reset_limiter():
    auth._attempts.clear()
    yield
    auth._attempts.clear()


def signup(email, name="Test"):
    c = TestClient(app)
    r = c.post("/api/auth/signup", json={"name": name, "email": email, "password": PASSWORD})
    assert r.status_code == 201, r.text
    return c


def test_public_endpoints_open_but_data_requires_login():
    c = TestClient(app)
    assert c.get("/api/health").status_code == 200
    assert c.get("/api/templates").status_code == 200
    assert c.get("/api/playlist/tracks").status_code == 200
    assert c.get("/api/auth/me").json() == {"user": None}
    for method, path in [
        ("get", "/api/documents"), ("get", "/api/dashboard/stats"), ("get", "/api/finance"),
        ("get", "/api/lab/snippets"), ("get", "/api/playlist/saved"), ("post", "/api/lab/run"),
        ("post", "/api/documents/from-template/blog-spark"),
    ]:
        assert getattr(c, method)(path).status_code == 401, path


def test_signup_login_logout_flow():
    c = signup("flow@example.com", "Flow")
    me = c.get("/api/auth/me").json()["user"]
    assert me["email"] == "flow@example.com" and me["name"] == "Flow"
    assert c.post("/api/auth/logout").status_code == 204
    assert c.get("/api/auth/me").json()["user"] is None
    assert c.get("/api/documents").status_code == 401

    bad = c.post("/api/auth/login", json={"email": "flow@example.com", "password": "nope-nope"})
    assert bad.status_code == 401
    unknown = c.post("/api/auth/login", json={"email": "ghost@example.com", "password": PASSWORD})
    assert unknown.status_code == 401
    assert unknown.json()["detail"] == bad.json()["detail"]  # no account enumeration

    ok = c.post("/api/auth/login", json={"email": "FLOW@example.com", "password": PASSWORD})
    assert ok.status_code == 200
    assert c.get("/api/documents").status_code == 200


def test_signup_validation_and_duplicates():
    c = TestClient(app)
    assert c.post("/api/auth/signup", json={"email": "x@example.com", "password": "short"}).status_code == 422
    assert c.post("/api/auth/signup", json={"email": "not-an-email", "password": PASSWORD}).status_code == 422
    signup("dupe@example.com")
    again = c.post("/api/auth/signup", json={"email": "Dupe@Example.com", "password": PASSWORD})
    assert again.status_code == 409


def test_login_rate_limited():
    signup("limit@example.com")
    c = TestClient(app)
    codes = [
        c.post("/api/auth/login", json={"email": "limit@example.com", "password": "wrong-pass"}).status_code
        for _ in range(12)
    ]
    assert codes[:10] == [401] * 10
    assert codes[10] == 429


def test_login_rate_limit_cannot_be_dodged_by_rotating_ip_header():
    signup("rotate@example.com")
    c = TestClient(app)
    codes = [
        c.post("/api/auth/login", json={"email": "rotate@example.com", "password": "wrong-pass"},
               headers={"x-forwarded-for": f"10.0.{i // 250}.{i % 250 + 1}"}).status_code
        for i in range(32)
    ]
    assert codes[:30] == [401] * 30
    assert codes[30] == 429


def test_each_user_only_sees_their_own_data():
    a, b = signup("iso-a@example.com"), signup("iso-b@example.com")
    doc = a.post("/api/documents", json={"title": "Private", "content": "mine"}).json()
    fin = a.post("/api/finance", json={"date": "2026-01-01", "amount": 5}).json()
    snip = a.post("/api/lab/snippets", json={"title": "s", "code": "print(1)"}).json()

    assert b.get("/api/documents").json() == []
    assert b.get(f"/api/documents/{doc['id']}").status_code == 404
    assert b.get(f"/api/documents/{doc['id']}/export").status_code == 404
    assert b.patch(f"/api/documents/{doc['id']}", json={"title": "hax"}).status_code == 404
    assert b.post(f"/api/documents/{doc['id']}/duplicate").status_code == 404
    assert b.delete(f"/api/documents/{doc['id']}").status_code == 404
    assert b.get(f"/api/finance/{fin['id']}").status_code == 404
    assert b.delete(f"/api/finance/{fin['id']}").status_code == 404
    assert b.get(f"/api/lab/snippets/{snip['id']}").status_code == 404
    assert b.post(f"/api/lab/snippets/{snip['id']}/run").status_code == 404
    assert b.get("/api/finance/summary").json()["entry_count"] == 0
    assert b.get("/api/dashboard/stats").json()["documents_total"] == 0
    assert a.get(f"/api/documents/{doc['id']}").json()["title"] == "Private"
    assert a.get("/api/dashboard/stats").json()["documents_total"] == 1


def test_saved_playlist_tracks_are_private_and_validated():
    a, b = signup("trk-a@example.com"), signup("trk-b@example.com")
    assert a.post("/api/playlist/saved", json={"title": "x", "url": "javascript:alert(1)"}).status_code == 422
    assert a.post("/api/playlist/saved", json={"title": "x", "url": "ftp://example.com/a.mp3"}).status_code == 422
    made = a.post("/api/playlist/saved", json={"title": "Lofi stream", "url": "https://www.youtube.com/watch?v=abc123"})
    assert made.status_code == 201
    assert [t["title"] for t in a.get("/api/playlist/saved").json()] == ["Lofi stream"]
    assert b.get("/api/playlist/saved").json() == []
    assert b.delete(f"/api/playlist/saved/{made.json()['id']}").status_code == 404
    assert a.delete(f"/api/playlist/saved/{made.json()['id']}").status_code == 204


def test_signup_allowlist(monkeypatch):
    monkeypatch.setattr(settings, "SIGNUP_ALLOWLIST", {"invited@example.com"})
    c = TestClient(app)
    assert c.post("/api/auth/signup", json={"email": "stranger@example.com", "password": PASSWORD}).status_code == 403
    assert c.post("/api/auth/signup", json={"email": "invited@example.com", "password": PASSWORD}).status_code == 201


# ---- OAuth ----------------------------------------------------------------

def test_providers_reflect_configuration(monkeypatch):
    c = TestClient(app)
    assert c.get("/api/auth/providers").json() == {"google": False, "github": False}
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "gid")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "gsecret")
    assert c.get("/api/auth/providers").json() == {"google": True, "github": False}


def test_oauth_login_not_configured_redirects_with_error():
    c = TestClient(app)
    r = c.get("/api/auth/github/login", follow_redirects=False)
    assert r.status_code in (302, 307)
    assert "/login?error=" in r.headers["location"]
    assert c.get("/api/auth/nope/login", follow_redirects=False).status_code == 404


def _configure(monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "gid")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "gsecret")
    monkeypatch.setattr(settings, "GITHUB_CLIENT_ID", "hid")
    monkeypatch.setattr(settings, "GITHUB_CLIENT_SECRET", "hsecret")


def _oauth_state(client, provider):
    r = client.get(f"/api/auth/{provider}/login", follow_redirects=False)
    assert r.status_code in (302, 307)
    return r.headers["location"], client.cookies.get("fs_oauth_state")


def test_oauth_redirect_url_and_state(monkeypatch):
    _configure(monkeypatch)
    c = TestClient(app)
    url, state = _oauth_state(c, "google")
    assert url.startswith("https://accounts.google.com/o/oauth2/v2/auth?")
    assert "client_id=gid" in url and f"state={state}" in url
    assert "redirect_uri=http%3A%2F%2Flocalhost%3A5173%2Fapi%2Fauth%2Fgoogle%2Fcallback" in url
    url, state = _oauth_state(c, "github")
    assert url.startswith("https://github.com/login/oauth/authorize?")
    assert "user%3Aemail" in url


def test_oauth_callback_rejects_bad_state(monkeypatch):
    _configure(monkeypatch)
    c = TestClient(app)
    _oauth_state(c, "google")
    r = c.get("/api/auth/google/callback?code=abc&state=forged", follow_redirects=False)
    assert "/login?error=" in r.headers["location"]
    assert c.get("/api/auth/me").json()["user"] is None
    r = TestClient(app).get("/api/auth/google/callback?code=abc&state=x", follow_redirects=False)
    assert "/login?error=" in r.headers["location"]


def _finish_oauth(monkeypatch, client, provider, profile):
    monkeypatch.setattr(auth_routes, "fetch_profile", lambda prov, code: profile)
    _, state = _oauth_state(client, provider)
    return client.get(f"/api/auth/{provider}/callback?code=abc&state={state}", follow_redirects=False)


def test_oauth_creates_account_and_logs_in(monkeypatch):
    _configure(monkeypatch)
    c = TestClient(app)
    prof = auth_routes.Profile("g-123", "oauth.new@example.com", "Ola Auth", "https://img/x.png")
    r = _finish_oauth(monkeypatch, c, "google", prof)
    assert r.headers["location"] == "http://localhost:5173/"
    me = c.get("/api/auth/me").json()["user"]
    assert me["email"] == "oauth.new@example.com"
    assert me["providers"] == ["google"] and me["has_password"] is False

    c2 = TestClient(app)
    _finish_oauth(monkeypatch, c2, "google", prof)
    assert c2.get("/api/auth/me").json()["user"]["id"] == me["id"]

    c3 = TestClient(app)
    _finish_oauth(monkeypatch, c3, "github", auth_routes.Profile("gh-9", "oauth.new@example.com", "Ola", ""))
    linked = c3.get("/api/auth/me").json()["user"]
    assert linked["id"] == me["id"] and set(linked["providers"]) == {"google", "github"}

    r = TestClient(app).post("/api/auth/login", json={"email": "oauth.new@example.com", "password": PASSWORD})
    assert r.status_code == 401 and "Google or GitHub" in r.json()["detail"]


def test_oauth_takeover_of_preregistered_unverified_account(monkeypatch):
    _configure(monkeypatch)
    attacker = signup("victim@example.com")
    assert attacker.get("/api/documents").status_code == 200
    victim = TestClient(app)
    _finish_oauth(monkeypatch, victim, "google", auth_routes.Profile("g-victim", "victim@example.com", "Vic", ""))
    assert victim.get("/api/auth/me").json()["user"]["email"] == "victim@example.com"
    assert attacker.get("/api/documents").status_code == 401  # old session revoked
    relog = TestClient(app).post("/api/auth/login", json={"email": "victim@example.com", "password": PASSWORD})
    assert relog.status_code == 401  # attacker's password wiped


def test_oauth_error_from_provider(monkeypatch):
    _configure(monkeypatch)
    r = TestClient(app).get("/api/auth/google/callback?error=access_denied", follow_redirects=False)
    assert "/login?error=" in r.headers["location"]


# ---- passwords, legacy data, migration -------------------------------------

def test_password_hash_roundtrip():
    h = auth.hash_password("s3cret-pass")
    assert h.startswith("scrypt$") and "s3cret-pass" not in h
    assert auth.verify_password("s3cret-pass", h)
    assert not auth.verify_password("other", h)
    assert not auth.verify_password("x", None) and not auth.verify_password("x", "garbage")
    assert auth.hash_password("s3cret-pass") != h


def test_first_account_claims_unowned_rows():
    db = SessionLocal()
    try:
        db.add(models.Document(id="legacy-doc", title="Old page", content="hi"))
        db.add(models.FinanceEntry(id="legacy-fin", date="2025-01-01", amount=1.0))
        db.add(models.Snippet(id="legacy-snip", title="old", code="1"))
        db.commit()
        auth._claim_legacy_data(db, "owner-id")
        db.commit()
        assert db.get(models.Document, "legacy-doc").user_id == "owner-id"
        assert db.get(models.FinanceEntry, "legacy-fin").user_id == "owner-id"
        assert db.get(models.Snippet, "legacy-snip").user_id == "owner-id"
    finally:
        db.close()


def test_migration_adds_user_id_without_losing_rows(monkeypatch):
    old = create_engine("sqlite://")
    with old.begin() as conn:
        conn.execute(text("CREATE TABLE documents (id VARCHAR(36) PRIMARY KEY, title VARCHAR(200))"))
        conn.execute(text("INSERT INTO documents VALUES ('d1', 'Kept')"))
    monkeypatch.setattr(migrate, "engine", old)
    migrate.run_migrations()
    migrate.run_migrations()  # idempotent
    with old.begin() as conn:
        row = conn.execute(text("SELECT id, title, user_id FROM documents")).one()
    assert tuple(row) == ("d1", "Kept", None)
