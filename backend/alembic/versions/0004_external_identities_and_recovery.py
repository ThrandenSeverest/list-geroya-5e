"""Link external identities to existing users and scope recovery sessions."""

from alembic import op
import sqlalchemy as sa

revision = "0004_external_identities"
down_revision = "0003_compact_storage"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("auth_sessions", sa.Column("scope", sa.String(), nullable=False, server_default="full"))
    op.create_table(
        "user_external_identities",
        sa.Column("provider", sa.String(), nullable=False),
        sa.Column("external_user_hash", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("provider", "external_user_hash"),
    )
    op.create_index("ix_user_external_identities_user_id", "user_external_identities", ["user_id"])
    connection = op.get_bind()
    rows = connection.execute(sa.text("SELECT id, email, created_at FROM users WHERE email LIKE '%@external.invalid'"))
    for user_id, email, created_at in rows:
        external_key = email[:-len("@external.invalid")]
        if ":" not in external_key:
            continue
        provider, external_hash = external_key.split(":", 1)
        if provider in {"telegram", "vk", "max"} and external_hash:
            connection.execute(sa.text(
                "INSERT OR IGNORE INTO user_external_identities (provider, external_user_hash, user_id, created_at) "
                "VALUES (:provider, :external_hash, :user_id, :created_at)"
            ), {"provider": provider, "external_hash": external_hash, "user_id": user_id, "created_at": created_at})


def downgrade():
    op.drop_index("ix_user_external_identities_user_id", table_name="user_external_identities")
    op.drop_table("user_external_identities")
    op.drop_column("auth_sessions", "scope")
