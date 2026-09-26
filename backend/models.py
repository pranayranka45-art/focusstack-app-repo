from datetime import datetime

from sqlalchemy import Column, DateTime, Float, String, Text

from database import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True)
    title = Column(String(200), nullable=False)
    content = Column(Text, default="")
    doc_type = Column(String(30), default="blog")  # blog, essay, mindmap, finance
    language = Column(String(30), default="markdown")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class FinanceEntry(Base):
    __tablename__ = "finance_entries"

    id = Column(String(36), primary_key=True)
    date = Column(String(10), nullable=False)
    category = Column(String(80), default="general")
    amount = Column(Float, default=0.0)
    kind = Column(String(20), default="expense")  # income | expense
    note = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class Snippet(Base):
    __tablename__ = "snippets"

    id = Column(String(36), primary_key=True)
    title = Column(String(200), nullable=False)
    language = Column(String(20), default="python")
    code = Column(Text, default="")
    last_output = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
