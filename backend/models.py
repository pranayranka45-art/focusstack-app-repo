from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, String, Text

from database import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), index=True, nullable=True)
    title = Column(String(200), nullable=False)
    content = Column(Text, default="")
    doc_type = Column(String(30), default="blog")  # blog, essay, mindmap, finance
    language = Column(String(30), default="markdown")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class FinanceEntry(Base):
    __tablename__ = "finance_entries"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), index=True, nullable=True)
    date = Column(String(10), nullable=False)
    category = Column(String(80), default="general")
    amount = Column(Float, default=0.0)
    kind = Column(String(20), default="expense")  # income | expense
    note = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class Snippet(Base):
    __tablename__ = "snippets"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), index=True, nullable=True)
    title = Column(String(200), nullable=False)
    language = Column(String(20), default="python")
    code = Column(Text, default="")
    last_output = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True)
    email = Column(String(320), unique=True, index=True, nullable=False)
    name = Column(String(120), default="")
    avatar_url = Column(String(500), default="")
    password_hash = Column(String(300), nullable=True)  # null for OAuth-only users
    email_verified = Column(Boolean, default=False)
    google_id = Column(String(64), unique=True, nullable=True)
    github_id = Column(String(32), unique=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserSession(Base):
    __tablename__ = "user_sessions"

    token_hash = Column(String(64), primary_key=True)  # sha256 of the cookie value
    user_id = Column(String(36), index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class PlaylistTrack(Base):
    """A link a user saved to their playlist (YouTube / Spotify / SoundCloud / audio URL)."""

    __tablename__ = "playlist_tracks"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), index=True, nullable=False)
    title = Column(String(200), nullable=False)
    url = Column(String(1000), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
