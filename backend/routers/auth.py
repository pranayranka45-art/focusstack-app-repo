import secrets
from dataclasses import dataclass
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import auth
import models
import settings
from database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])

STATE_COOKIE = "fs_oauth_state"


class SignupBody(BaseModel):
    name: str = Field(default="", max_length=120)
    email: str = Field(..., max_length=320)
    password: str = Field(..., min_length=8, max_length=200)


class LoginBody(BaseModel):
    email: str = Field(..., max_length=320)
    password: str = Field(..., max_length=200)


def _clean_email(raw: str) -> str:
    email = raw.strip().lower()
    if not auth.EMAIL_RE.match(email):
        raise HTTPException(status_code=422, detail="Enter a valid email address.")
    return email


# ---- email + password ------------------------------------------------------

@router.get("/providers")
def providers():
    return {
        "google": settings.oauth_enabled("google"),
        "github": settings.oauth_enabled("github"),
    }


@router.get("/me")
def me(user: dict | None = Depends(auth.optional_user)):
    return {"user": user}


@router.post("/signup", status_code=201)
def signup(body: SignupBody, request: Request, response: Response, db: Session = Depends(get_db)):
    auth.rate_limit(f"signup:{auth.client_ip(request)}", limit=10, window=3600)
    email = _clean_email(body.email)
    if not auth.signup_allowed(email):
        raise HTTPException(status_code=403, detail="Signups are limited to invited emails.")
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    user = auth.create_user(
        db, email=email, name=body.name or email.split("@")[0], password=body.password
    )
    auth.start_session(db, response, user.id)
    return {"user": auth.public_user(user)}


@router.post("/login")
def login(body: LoginBody, request: Request, response: Response, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    key = f"login:{auth.client_ip(request)}:{email}"
    email_key = f"login-email:{email}"
    auth.rate_limit(key)
    # Per-email cap that ignores the (spoofable) client IP, so rotating headers can't brute-force one account.
    auth.rate_limit(email_key, limit=30)
    user = db.query(models.User).filter(models.User.email == email).first()
    stored = user.password_hash if user else None
    ok = auth.verify_password(body.password, stored or auth._DUMMY_HASH)
    if not user or not stored or not ok:
        if user and not stored:
            raise HTTPException(
                status_code=401,
                detail="This account uses Google or GitHub. Use that button to sign in.",
            )
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    if not auth.signup_allowed(email):
        raise HTTPException(status_code=403, detail="Signups are limited to invited emails.")
    auth._attempts.pop(key, None)
    auth._attempts.pop(email_key, None)
    auth.start_session(db, response, user.id)
    return {"user": auth.public_user(user)}


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    auth.end_session(db, request, response)


# ---- OAuth (Google, GitHub) --------------------------------------------------

@dataclass
class Profile:
    provider_id: str
    email: str
    name: str
    avatar_url: str


def _redirect_uri(provider: str) -> str:
    return f"{settings.APP_URL}/api/auth/{provider}/callback"


def _login_error(message: str) -> RedirectResponse:
    resp = RedirectResponse(f"{settings.APP_URL}/login?{urlencode({'error': message})}")
    resp.delete_cookie(STATE_COOKIE, path="/")
    return resp


def fetch_profile(provider: str, code: str) -> Profile:
    """Exchange an OAuth code for the user's profile. Raises ValueError with a safe message."""
    timeout = httpx.Timeout(10.0)
    try:
        if provider == "google":
            tok = httpx.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": _redirect_uri("google"),
                    "grant_type": "authorization_code",
                },
                timeout=timeout,
            )
            tok.raise_for_status()
            access = tok.json()["access_token"]
            info = httpx.get(
                "https://openidconnect.googleapis.com/v1/userinfo",
                headers={"Authorization": f"Bearer {access}"},
                timeout=timeout,
            )
            info.raise_for_status()
            data = info.json()
            if not data.get("email") or not data.get("email_verified"):
                raise ValueError("Your Google email is not verified.")
            return Profile(
                provider_id=str(data["sub"]),
                email=data["email"],
                name=data.get("name") or "",
                avatar_url=data.get("picture") or "",
            )

        tok = httpx.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": _redirect_uri("github"),
            },
            headers={"Accept": "application/json"},
            timeout=timeout,
        )
        tok.raise_for_status()
        access = tok.json().get("access_token")
        if not access:
            raise ValueError("GitHub did not approve the sign-in.")
        headers = {
            "Authorization": f"Bearer {access}",
            "Accept": "application/vnd.github+json",
            "User-Agent": "FocusStack",
        }
        user = httpx.get("https://api.github.com/user", headers=headers, timeout=timeout)
        user.raise_for_status()
        emails = httpx.get("https://api.github.com/user/emails", headers=headers, timeout=timeout)
        emails.raise_for_status()
        verified = [e for e in emails.json() if e.get("verified")]
        primary = next((e for e in verified if e.get("primary")), verified[0] if verified else None)
        if not primary:
            raise ValueError("Your GitHub account has no verified email address.")
        data = user.json()
        return Profile(
            provider_id=str(data["id"]),
            email=primary["email"],
            name=data.get("name") or data.get("login") or "",
            avatar_url=data.get("avatar_url") or "",
        )
    except httpx.HTTPError:
        raise ValueError("Could not reach the sign-in provider. Please try again.")
    except (KeyError, TypeError):
        raise ValueError("Unexpected response from the sign-in provider.")


def _authorize_url(provider: str, state: str) -> str:
    if provider == "google":
        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": _redirect_uri("google"),
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "prompt": "select_account",
        }
        return "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)
    params = {
        "client_id": settings.GITHUB_CLIENT_ID,
        "redirect_uri": _redirect_uri("github"),
        "scope": "read:user user:email",
        "state": state,
    }
    return "https://github.com/login/oauth/authorize?" + urlencode(params)


def _check_provider(provider: str) -> None:
    if provider not in ("google", "github"):
        raise HTTPException(status_code=404, detail="Unknown provider")


@router.get("/{provider}/login")
def oauth_login(provider: str):
    _check_provider(provider)
    if not settings.oauth_enabled(provider):
        return _login_error(f"{provider.title()} sign-in is not set up yet.")
    state = secrets.token_urlsafe(24)
    resp = RedirectResponse(_authorize_url(provider, state))
    resp.set_cookie(
        STATE_COOKIE, state, max_age=600, httponly=True,
        secure=settings.COOKIE_SECURE, samesite="lax", path="/",
    )
    return resp


@router.get("/{provider}/callback")
def oauth_callback(
    provider: str,
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
):
    _check_provider(provider)
    if error:
        return _login_error("Sign-in was cancelled.")
    expected = request.cookies.get(STATE_COOKIE)
    if not code or not state or not expected or not secrets.compare_digest(state, expected):
        return _login_error("Sign-in expired. Please try again.")
    try:
        profile = fetch_profile(provider, code)
    except ValueError as exc:
        return _login_error(str(exc))
    if not auth.signup_allowed(profile.email):
        return _login_error("Signups are limited to invited emails.")

    user = auth.upsert_oauth_user(
        db,
        provider=provider,
        provider_id=profile.provider_id,
        email=profile.email,
        name=profile.name,
        avatar_url=profile.avatar_url,
    )
    resp = RedirectResponse(f"{settings.APP_URL}/")
    resp.delete_cookie(STATE_COOKIE, path="/")
    auth.start_session(db, resp, user.id)
    return resp
