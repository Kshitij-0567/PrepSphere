"""Video mock interviews: interview plans, question kinds and follow-ups, and answer media data.

Revision ID: 0004_video_interviews
Revises: 0003_linked_profiles
Create Date: 2026-09-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0004_video_interviews"
down_revision: Union[str, Sequence[str], None] = "0003_linked_profiles"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("interviews", sa.Column("mode", sa.String(), nullable=False, server_default="text"))
    op.add_column("interviews", sa.Column("plan", sa.JSON(), nullable=True))

    op.add_column("questions", sa.Column("kind", sa.String(), nullable=False, server_default="spoken"))
    op.add_column("questions", sa.Column("step_index", sa.Integer(), nullable=True))
    op.add_column("questions", sa.Column("details", sa.JSON(), nullable=True))
    # SQLite cannot add a foreign key in place; batch mode rebuilds the table (foreign key
    # checks are off while migrations run, so the answers that reference it are untouched).
    with op.batch_alter_table("questions") as batch:
        batch.add_column(sa.Column("parent_id", sa.Integer(), nullable=True))
        batch.create_foreign_key("fk_questions_parent_id", "questions", ["parent_id"], ["id"])

    op.add_column("answers", sa.Column("transcript_source", sa.String(), nullable=True))
    op.add_column("answers", sa.Column("segments", sa.JSON(), nullable=True))
    op.add_column("answers", sa.Column("code", sa.Text(), nullable=True))
    op.add_column("answers", sa.Column("code_language", sa.String(), nullable=True))
    op.add_column("answers", sa.Column("diagram_image", sa.Text(), nullable=True))
    op.add_column("answers", sa.Column("delivery", sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("answers") as batch:
        for column in ("delivery", "diagram_image", "code_language", "code", "segments", "transcript_source"):
            batch.drop_column(column)
    with op.batch_alter_table("questions") as batch:
        batch.drop_constraint("fk_questions_parent_id", type_="foreignkey")
        for column in ("parent_id", "details", "step_index", "kind"):
            batch.drop_column(column)
    with op.batch_alter_table("interviews") as batch:
        batch.drop_column("plan")
        batch.drop_column("mode")
