"""compact vault payloads and normalized homebrew entities

Revision ID: 0003_compact_storage
Revises: 0002_homebrew_library
"""
from alembic import op
import sqlalchemy as sa

revision = "0003_compact_storage"
down_revision = "0002_homebrew_library"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("character_vaults", sa.Column("schema_version", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("character_vaults", sa.Column("payload_codec", sa.String(), nullable=True))
    op.add_column("character_vaults", sa.Column("compact_payload", sa.LargeBinary(), nullable=True))
    op.create_table(
        "homebrew_entities",
        sa.Column("owner_user_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("sort_index", sa.Integer(), nullable=False),
        sa.Column("schema_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("payload_codec", sa.String(), nullable=False),
        sa.Column("content_blob", sa.LargeBinary(), nullable=False),
        sa.Column("content_hash", sa.String(), nullable=False),
        sa.Column("updated_at", sa.String(), nullable=False),
    )
    op.create_index("ix_homebrew_entities_owner", "homebrew_entities", ["owner_user_id"])


def downgrade():
    op.drop_index("ix_homebrew_entities_owner", table_name="homebrew_entities")
    op.drop_table("homebrew_entities")
    op.drop_column("character_vaults", "compact_payload")
    op.drop_column("character_vaults", "payload_codec")
    op.drop_column("character_vaults", "schema_version")
