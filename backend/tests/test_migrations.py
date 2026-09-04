import os
import tempfile
import pytest
from sqlalchemy import create_engine, inspect
from alembic.config import Config
from alembic import command

def test_alembic_upgrade_and_downgrade_lifecycle():
    """Validates that Alembic migrations run upgrade and downgrade cleanly on a fresh database."""
    with tempfile.TemporaryDirectory() as tmpdir:
        test_db_path = os.path.join(tmpdir, "test_migration.db")
        db_url = f"sqlite:///{test_db_path}"

        base_dir = os.path.dirname(os.path.dirname(__file__))
        ini_path = os.path.join(base_dir, "alembic.ini")
        alembic_cfg = Config(ini_path)
        alembic_cfg.set_main_option("script_location", os.path.join(base_dir, "alembic"))
        alembic_cfg.set_main_option("sqlalchemy.url", db_url)

        # 1. Run upgrade to head
        command.upgrade(alembic_cfg, "head")

        engine = create_engine(db_url)
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())

        expected_tables = {
            "alembic_version",
            "users",
            "candidates",
            "scores",
            "blacklisted_tokens",
            "api_keys",
            "webhooks",
            "webhook_deliveries",
            "idempotency_keys"
        }
        assert expected_tables.issubset(tables), f"Missing tables: {expected_tables - tables}"

        # Verify columns of candidates table
        candidate_cols = {col["name"] for col in inspector.get_columns("candidates")}
        assert {"id", "name", "email", "role_applied", "status", "skills", "internal_notes", "ai_summary", "created_at", "updated_at"}.issubset(candidate_cols)

        # 2. Run downgrade to base
        command.downgrade(alembic_cfg, "base")
        inspector_after_down = inspect(engine)
        tables_after_down = set(inspector_after_down.get_table_names())
        assert "candidates" not in tables_after_down
        assert "users" not in tables_after_down
        assert "scores" not in tables_after_down

        # 3. Re-run upgrade to head
        command.upgrade(alembic_cfg, "head")
        inspector_reup = inspect(engine)
        tables_reup = set(inspector_reup.get_table_names())
        assert expected_tables.issubset(tables_reup)
