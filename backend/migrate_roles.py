"""
Re-syncs the role and skill catalog from core/seed_data.py.

The app already does this on every startup, and the sync updates roles in place, so
interview history keeps pointing at the right roles. (This script used to drop the roles
tables, which broke those references.) Run it only to refresh the catalog manually:

    python migrate_roles.py
"""
from core import database, models, seed_data
from core.migrations import run_migrations

run_migrations()
db = database.SessionLocal()
try:
    seed_data.seed_roles_and_skills(db)
    roles = db.query(models.Role).order_by(models.Role.id).all()
    print(f"Total Universal Engineering Roles: {len(roles)}")
    for r in roles:
        print(f"[{r.category}] {r.name} - {len(r.role_skills)} skills")
finally:
    db.close()
