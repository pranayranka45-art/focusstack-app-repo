from sqlalchemy import inspect, text

from database import engine

OWNED_TABLES = ("documents", "finance_entries", "snippets")


def run_migrations() -> None:
    """Add the user_id column to tables created before accounts existed (keeps data)."""
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    with engine.begin() as conn:
        for table in OWNED_TABLES:
            if table not in tables:
                continue
            columns = {c["name"] for c in inspector.get_columns(table)}
            if "user_id" not in columns:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN user_id VARCHAR(36)"))
            conn.execute(
                text(f"CREATE INDEX IF NOT EXISTS ix_{table}_user_id ON {table} (user_id)")
            )
