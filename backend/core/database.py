from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import settings


def _create_engine(url: str):
    if url.startswith("sqlite"):
        engine = create_engine(url, connect_args={"check_same_thread": False})

        # SQLite ignores foreign keys unless every connection opts in.
        @event.listens_for(engine, "connect")
        def _enable_foreign_keys(dbapi_connection, _record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        return engine

    return create_engine(
        url,
        pool_pre_ping=True,      # Checks if connection is alive before using it
        pool_recycle=3600,       # Recycles connections every hour
        pool_size=10,            # Maintain 10 connections
        max_overflow=20          # Allow up to 20 extra if needed
    )


engine = _create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
