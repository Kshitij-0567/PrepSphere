import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, inspect, text

from core import models
from core.migrations import alembic_config, run_migrations


def _url(tmp_path, name):
    return f"sqlite:///{(tmp_path / name).as_posix()}"


def test_migrations_produce_exactly_the_model_schema(tmp_path):
    url = _url(tmp_path, "fresh.db")
    run_migrations(url)
    engine = create_engine(url)
    with engine.connect() as connection:
        diff = compare_metadata(MigrationContext.configure(connection), models.Base.metadata)
    engine.dispose()
    assert diff == []


def test_database_created_by_old_create_all_is_adopted(tmp_path):
    url = _url(tmp_path, "legacy.db")
    # Build the pre-migration schema, then drop the version table so it looks like create_all() made it.
    command.upgrade(alembic_config(url), "0001_baseline")
    engine = create_engine(url)
    with engine.begin() as connection:
        connection.execute(text("DROP TABLE alembic_version"))
        connection.execute(text("INSERT INTO users (id, email, password_hash) VALUES (1, 'g@example.com', 'GOOGLE_OAUTH_USER')"))
        connection.execute(text("INSERT INTO resumes (id, user_id, filename) VALUES (1, 1, 'old.pdf'), (2, 1, 'new.pdf')"))

    run_migrations(url)

    with engine.connect() as connection:
        assert connection.execute(text("SELECT version_num FROM alembic_version")).scalar() == "0004_video_interviews"
        assert connection.execute(text("SELECT password_hash FROM users WHERE id = 1")).scalar() is None
        active = connection.execute(text("SELECT id FROM resumes WHERE is_active = 1")).scalars().all()
        assert active == [2]
        assert "interview_id" in {c["name"] for c in inspect(connection).get_columns("recommendations")}
    engine.dispose()
    assert (tmp_path / "legacy.db.backup-0001_baseline").exists()


def test_unknown_revision_is_reported_clearly(tmp_path):
    url = _url(tmp_path, "foreign.db")
    engine = create_engine(url)
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
        connection.execute(text("INSERT INTO alembic_version VALUES ('f44c6d86d643')"))
    engine.dispose()
    with pytest.raises(RuntimeError, match="legacy InterviewAI"):
        run_migrations(url)
