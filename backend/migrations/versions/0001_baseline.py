"""Baseline: the PrepSphere schema as it existed when the app still used create_all().

Databases created by that older startup code are stamped at this revision automatically
(see core/migrations.py), so this migration only ever runs against an empty database.

Revision ID: 0001_baseline
Revises:
Create Date: 2026-09-26

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0001_baseline"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("password_hash", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    op.create_table(
        "roles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("category", sa.String(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_roles_id"), "roles", ["id"], unique=False)
    op.create_index(op.f("ix_roles_name"), "roles", ["name"], unique=True)

    op.create_table(
        "skills",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("canonical_name", sa.String(), nullable=True),
        sa.Column("category", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_skills_id"), "skills", ["id"], unique=False)
    op.create_index(op.f("ix_skills_name"), "skills", ["name"], unique=False)
    op.create_index(op.f("ix_skills_canonical_name"), "skills", ["canonical_name"], unique=False)

    op.create_table(
        "companies",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("tier", sa.String(), nullable=True),
        sa.Column("industry", sa.String(), nullable=True),
        sa.Column("domain", sa.String(), nullable=True),
        sa.Column("logo_url", sa.String(), nullable=True),
        sa.Column("interview_focus", sa.JSON(), nullable=True),
        sa.Column("common_topics", sa.JSON(), nullable=True),
        sa.Column("difficulty_level", sa.String(), nullable=True),
        sa.Column("headquarters", sa.String(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("what_company_wants", sa.Text(), nullable=True),
        sa.Column("interview_rounds", sa.JSON(), nullable=True),
        sa.Column("prep_tips", sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_companies_id"), "companies", ["id"], unique=False)
    op.create_index(op.f("ix_companies_name"), "companies", ["name"], unique=True)

    op.create_table(
        "role_skills",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("role_id", sa.Integer(), nullable=True),
        sa.Column("skill_id", sa.Integer(), nullable=True),
        sa.Column("importance_weight", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"]),
        sa.ForeignKeyConstraint(["skill_id"], ["skills.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_role_skills_id"), "role_skills", ["id"], unique=False)

    op.create_table(
        "resumes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("file_path", sa.String(), nullable=True),
        sa.Column("filename", sa.String(), nullable=True),
        sa.Column("raw_text", sa.Text(), nullable=True),
        sa.Column("extracted_skills_json", sa.JSON(), nullable=True),
        sa.Column("parsed_profile_json", sa.JSON(), nullable=True),
        sa.Column("quality_analysis_json", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_resumes_id"), "resumes", ["id"], unique=False)

    op.create_table(
        "candidate_skills",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("skill_id", sa.Integer(), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("source", sa.String(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["skill_id"], ["skills.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_candidate_skills_id"), "candidate_skills", ["id"], unique=False)

    op.create_table(
        "interviews",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("role_id", sa.Integer(), nullable=True),
        sa.Column("company_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("overall_score", sa.Float(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_interviews_id"), "interviews", ["id"], unique=False)

    op.create_table(
        "questions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("interview_id", sa.Integer(), nullable=True),
        sa.Column("skill_id", sa.Integer(), nullable=True),
        sa.Column("question_text", sa.Text(), nullable=True),
        sa.Column("difficulty", sa.String(), nullable=True),
        sa.Column("expected_concepts", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["interview_id"], ["interviews.id"]),
        sa.ForeignKeyConstraint(["skill_id"], ["skills.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_questions_id"), "questions", ["id"], unique=False)

    op.create_table(
        "answers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("interview_id", sa.Integer(), nullable=True),
        sa.Column("question_id", sa.Integer(), nullable=True),
        sa.Column("answer_text", sa.Text(), nullable=True),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("rubric_json", sa.JSON(), nullable=True),
        sa.Column("feedback", sa.Text(), nullable=True),
        sa.Column("evaluated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["interview_id"], ["interviews.id"]),
        sa.ForeignKeyConstraint(["question_id"], ["questions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_answers_id"), "answers", ["id"], unique=False)

    op.create_table(
        "recommendations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("skill_id", sa.Integer(), nullable=True),
        sa.Column("topic", sa.String(), nullable=True),
        sa.Column("priority", sa.String(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["skill_id"], ["skills.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_recommendations_id"), "recommendations", ["id"], unique=False)


def downgrade() -> None:
    for table in [
        "recommendations", "answers", "questions", "interviews", "candidate_skills",
        "resumes", "role_skills", "companies", "skills", "roles", "users",
    ]:
        op.drop_table(table)
