"""Linked LinkedIn and GitHub profiles, and the cached GitHub import.

Revision ID: 0003_linked_profiles
Revises: 0002_interview_context
Create Date: 2026-09-26

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0003_linked_profiles"
down_revision: Union[str, Sequence[str], None] = "0002_interview_context"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("linkedin_handle", sa.String(), nullable=True))
    op.add_column("users", sa.Column("github_username", sa.String(), nullable=True))
    op.add_column("users", sa.Column("github_data", sa.JSON(), nullable=True))
    op.add_column("users", sa.Column("github_synced_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.drop_column("github_synced_at")
        batch.drop_column("github_data")
        batch.drop_column("github_username")
        batch.drop_column("linkedin_handle")
