"""Track the active resume, interview seniority/JD context, and per-interview recommendations.

Revision ID: 0002_interview_context
Revises: 0001_baseline
Create Date: 2026-09-26

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0002_interview_context"
down_revision: Union[str, Sequence[str], None] = "0001_baseline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Plain ADD COLUMN statements work on SQLite without rebuilding the tables.
    op.add_column("resumes", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("interviews", sa.Column("seniority", sa.String(), nullable=True))
    op.add_column("interviews", sa.Column("job_description", sa.Text(), nullable=True))
    op.add_column("interviews", sa.Column("jd_skills", sa.JSON(), nullable=True))

    # SQLite cannot add a foreign key in place; batch mode rebuilds this (unreferenced) table.
    with op.batch_alter_table("recommendations") as batch:
        batch.add_column(sa.Column("interview_id", sa.Integer(), nullable=True))
        batch.create_foreign_key("fk_recommendations_interview_id", "interviews", ["interview_id"], ["id"])

    bind = op.get_bind()
    # Each user's most recent upload becomes their active resume.
    bind.execute(
        sa.text(
            "UPDATE resumes SET is_active = :active "
            "WHERE id IN (SELECT MAX(id) FROM resumes GROUP BY user_id)"
        ),
        {"active": True},
    )
    # Google accounts used to get a placeholder string instead of a password hash.
    bind.execute(sa.text("UPDATE users SET password_hash = NULL WHERE password_hash = 'GOOGLE_OAUTH_USER'"))
    bind.execute(sa.text("UPDATE interviews SET seniority = 'Mid' WHERE seniority IS NULL"))


def downgrade() -> None:
    with op.batch_alter_table("recommendations") as batch:
        batch.drop_constraint("fk_recommendations_interview_id", type_="foreignkey")
        batch.drop_column("interview_id")
    with op.batch_alter_table("interviews") as batch:
        batch.drop_column("jd_skills")
        batch.drop_column("job_description")
        batch.drop_column("seniority")
    with op.batch_alter_table("resumes") as batch:
        batch.drop_column("is_active")
