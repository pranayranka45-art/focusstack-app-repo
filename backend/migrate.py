from sqlalchemy import inspect, text

from database import engine


def run_migrations():
    """Add new columns to existing tables without dropping data."""
    inspector = inspect(engine)

    if "automations" in inspector.get_table_names():
        existing = {c["name"] for c in inspector.get_columns("automations")}
        new_cols = {
            "source_type": "VARCHAR(20) DEFAULT 'template'",
            "file_path": "VARCHAR(500)",
            "original_filename": "VARCHAR(255)",
            "file_type": "VARCHAR(50)",
            "file_size": "INTEGER",
        }
        with engine.begin() as conn:
            for col, typedef in new_cols.items():
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE automations ADD COLUMN {col} {typedef}"))

    if "documents" not in inspector.get_table_names():
        from models import Document
        from database import Base
        Document.__table__.create(bind=engine, checkfirst=True)
