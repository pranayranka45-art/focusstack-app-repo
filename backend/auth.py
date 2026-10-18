"""Authentication helpers: password hashing, DB-backed sessions, current-user dependency."""

import base64
import hashlib
import hmac
import re
import secrets
import time
import uuid
from datetime import datetime, timedelta

from fastapi import HTTPException, Request, Response

import models
import settings
from database import SessionLocal

COOKIE_NAME = "fs_session"
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

_SCRYPT_N, _SCRYPT_R, _SCRYPT_P = 2**14, 8, 1


# ---- passwords (stdlib scrypt, no extra dependency) ---------------------

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode(), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P, dklen=32
    )
    b64 = lambda b: base64.b64encode(b).decode()  # noqa: E731
    return f"scrypt${_SCRYPT_N}${_SCRYPT_R}${_SCRYPT_P}${b64(salt)}${b64(digest)}"


def verify_password(password: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        scheme, n, r, p, salt_b64, digest_b64 = stored.split("$")
        if scheme != "scrypt":
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(digest_b64)
        actual = hashlib.scrypt(
            password.encode(), salt=salt, n=int(n), r=int(r), p=int(p), dklen=len(expected)
        )
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


# Used to keep login timing similar whether or not the email exists.
_DUMMY_HASH = hash_password("not-a-real-password")


# ---- users ---------------------------------------------------------------

def public_user(user: models.User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name or user.email.split("@")[0],
        "avatar_url": user.avatar_url or "",
        "has_password": bool(user.password_hash),
        "providers": [
            name
            for name, value in (("google", user.google_id), ("github", user.github_id))
            if value
        ],
    }


def signup_allowed(email: str) -> bool:
    allow = settings.SIGNUP_ALLOWLIST
    return not allow or email.lower() in allow


def _claim_legacy_data(db, user_id: str) -> None:
    """The very first account adopts rows created before accounts existed."""
    for model in (models.Document, models.FinanceEntry, models.Snippet):
        db.query(model).filter(model.user_id.is_(None)).update(
            {model.user_id: user_id}, synchronize_session=False
        )


def create_user(db, *, email: str, name: str = "", avatar_url: str = "",
                password: str | None = None, email_verified: bool = False,
                google_id: str | None = None, github_id: str | None = None) -> models.User:
    first_user = db.query(models.User).count() == 0
    user = models.User(
        id=str(uuid.uuid4()),
        email=email.lower(),
        name=name.strip()[:120],
        avatar_url=(avatar_url or "")[:500],
        password_hash=hash_password(password) if password else None,
        email_verified=email_verified,
        google_id=google_id,
        github_id=github_id,
    )
    db.add(user)
    db.flush()
    if first_user:
        _claim_legacy_data(db, user.id)
    db.commit()
    db.refresh(user)
    return user


def upsert_oauth_user(db, *, provider: str, provider_id: str, email: str,
                      name: str, avatar_url: str) -> models.User:
    """Find or create the user for a *provider-verified* email."""
    id_col = models.User.google_id if provider == "google" else models.User.github_id
    email = email.lower()

    user = db.query(models.User).filter(id_col == provider_id).first()
    if user:
        return user

    user = db.query(models.User).filter(models.User.email == email).first()
    if user:
        # The provider verified this email. If the existing account's email was never
        # verified, someone may have pre-registered it with a password they know:
        # wipe that password and revoke its sessions before linking.
        if not user.email_verified:
            user.password_hash = None
            db.query(models.UserSession).filter(models.UserSession.user_id == user.id).delete()
            user.email_verified = True
        setattr(user, "google_id" if provider == "google" else "github_id", provider_id)
        if not user.name:
            user.name = name[:120]
        if not user.avatar_url:
            user.avatar_url = (avatar_url or "")[:500]
        db.commit()
        db.refresh(user)
        return user

    kwargs = {"google_id": provider_id} if provider == "google" else {"github_id": provider_id}
    return create_user(
        db, email=email, name=name, avatar_url=avatar_url, email_verified=True, **kwargs
    )


# ---- sessions ------------------------------------------------------------

def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def start_session(db, response: Response, user_id: str) -> None:
    token = secrets.token_urlsafe(32)
    expires = datetime.utcnow() + timedelta(days=settings.SESSION_DAYS)
    db.add(models.UserSession(token_hash=_hash_token(token), user_id=user_id, expires_at=expires))
    db.query(models.UserSession).filter(models.UserSession.expires_at < datetime.utcnow()).delete()
    db.commit()
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=settings.SESSION_DAYS * 86400,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        path="/",
    )


def end_session(db, request: Request, response: Response) -> None:
    token = request.cookies.get(COOKIE_NAME)
    if token:
        db.query(models.UserSession).filter(
            models.UserSession.token_hash == _hash_token(token)
        ).delete()
        db.commit()
    response.delete_cookie(COOKIE_NAME, path="/")


def _user_from_request(request: Request) -> dict | None:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    db = SessionLocal()
    try:
        session = (
            db.query(models.UserSession)
            .filter(models.UserSession.token_hash == _hash_token(token))
            .first()
        )
        if not session or session.expires_at < datetime.utcnow():
            return None
        user = db.query(models.User).filter(models.User.id == session.user_id).first()
        return public_user(user) if user else None
    finally:
        db.close()


def optional_user(request: Request) -> dict | None:
    return _user_from_request(request)


def require_user(request: Request) -> dict:
    user = _user_from_request(request)
    if not user:
        raise HTTPException(status_code=401, detail="Please log in to continue.")
    return user


# ---- tiny in-memory rate limiter for credential endpoints -----------------

_attempts: dict[str, list[float]] = {}


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(key: str, limit: int = 10, window: int = 900) -> None:
    now = time.time()
    hits = [t for t in _attempts.get(key, []) if now - t < window]
    if len(hits) >= limit:
        _attempts[key] = hits
        raise HTTPException(status_code=429, detail="Too many attempts. Try again in a few minutes.")
    hits.append(now)
    _attempts[key] = hits
    if len(_attempts) > 5000:  # keep memory bounded
        for k in [k for k, v in _attempts.items() if not v or now - v[-1] > window]:
            _attempts.pop(k, None)
