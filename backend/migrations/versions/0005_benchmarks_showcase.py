"""Benchmarks and the resume showcase: the user's country, published resumes and reports.

Revision ID: 0005_benchmarks_showcase
Revises: 0004_video_interviews
Create Date: 2026-10-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0005_benchmarks_showcase"
down_revision: Union[str, Sequence[str], None] = "0004_video_interviews"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("country", sa.String(length=2), nullable=True))

    op.create_table(
        "resume_showcases",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("public_id", sa.String(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("resume_id", sa.Integer(), nullable=True),
        sa.Column("role_id", sa.Integer(), nullable=False),
        sa.Column("seniority", sa.String(), nullable=False),
        sa.Column("handle", sa.String(), nullable=False),
        sa.Column("show_name", sa.Boolean(), nullable=False),
        sa.Column("content", sa.JSON(), nullable=False),
        sa.Column("options", sa.JSON(), nullable=True),
        sa.Column("hidden", sa.Boolean(), nullable=False),
        sa.Column("published_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["resume_id"], ["resumes.id"]),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(op.f("ix_resume_showcases_id"), "resume_showcases", ["id"], unique=False)
    op.create_index(op.f("ix_resume_showcases_public_id"), "resume_showcases", ["public_id"], unique=True)

    op.create_table(
        "showcase_reports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("showcase_id", sa.Integer(), nullable=False),
        sa.Column("reporter_id", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["reporter_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["showcase_id"], ["resume_showcases.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("showcase_id", "reporter_id", name="uq_showcase_reports_reporter"),
    )
    op.create_index(op.f("ix_showcase_reports_id"), "showcase_reports", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_showcase_reports_id"), table_name="showcase_reports")
    op.drop_table("showcase_reports")
    op.drop_index(op.f("ix_resume_showcases_public_id"), table_name="resume_showcases")
    op.drop_index(op.f("ix_resume_showcases_id"), table_name="resume_showcases")
    op.drop_table("resume_showcases")
    with op.batch_alter_table("users") as batch:
        batch.drop_column("country")
