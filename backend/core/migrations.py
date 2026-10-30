"""
Brings the database schema up to date at startup.

Databases created by the old create_all() startup code have tables but no
alembic_version row; they already match the baseline revision, so they are stamped
rather than migrated. SQLite files are copied before any pending migration runs.
"""
import logging
import shutil
from pathlib import Path
from typing import Optional

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from alembic.util.exc import CommandError
from sqlalchemy import create_engine, inspect
from sqlalchemy.pool import NullPool

from .config import BACKEND_DIR, settings

logger = logging.getLogger(__name__)

BASELINE_REVISION = "0001_baseline"


def alembic_config(database_url: Optional[str] = None) -> Config:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    cfg.set_main_option("sqlalchemy.url", (database_url or settings.database_url).replace("%", "%%"))
    cfg.attributes["configure_logger"] = False
    return cfg


def _sqlite_file(database_url: str) -> Optional[Path]:
    prefix = "sqlite:///"
    if not database_url.startswith(prefix) or database_url.endswith(":memory:"):
        return None
    path = Path(database_url[len(prefix):])
    return path if path.exists() else None


def _backup_sqlite(database_url: str, current_revision: str) -> None:
    db_file = _sqlite_file(database_url)
    if db_file is None:
        return
    backup = db_file.with_name(f"{db_file.name}.backup-{current_revision}")
    if not backup.exists():
        shutil.copy2(db_file, backup)
        logger.info("Backed up %s to %s before migrating", db_file.name, backup.name)


def run_migrations(database_url: Optional[str] = None) -> None:
    url = database_url or settings.database_url
    cfg = alembic_config(url)
    script = ScriptDirectory.from_config(cfg)
    head = script.get_current_head()

    engine = create_engine(url, poolclass=NullPool)
    try:
        with engine.connect() as connection:
            tables = set(inspect(connection).get_table_names())
            current = MigrationContext.configure(connection).get_current_revision()
    finally:
        engine.dispose()

    if current is None and "users" in tables:
        logger.info("Existing database without migration history detected; stamping %s", BASELINE_REVISION)
        command.stamp(cfg, BASELINE_REVISION)
        current = BASELINE_REVISION
    elif current is not None:
        try:
            script.get_revision(current)
        except CommandError as exc:
            raise RuntimeError(
                f"The database at DATABASE_URL is at unknown migration revision {current!r}. "
                "It was most likely created by the legacy InterviewAI app, whose schema is not "
                "compatible with PrepSphere. Point DATABASE_URL at a new, empty database."
            ) from exc

    if current == head:
        return

    if current is not None:
        _backup_sqlite(url, current)
    logger.info("Upgrading database schema from %s to %s", current or "empty", head)
    command.upgrade(cfg, "head")
