"""account-scoped homebrew library

Revision ID: 0002_homebrew_library
Revises: 0001_initial
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_homebrew_library"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "homebrew_libraries",
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("library_json", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.String(), nullable=False),
    )


def downgrade():
    op.drop_table("homebrew_libraries")
