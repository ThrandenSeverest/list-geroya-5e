"""initial user/auth/vault schema"""
from alembic import op
import sqlalchemy as sa
revision = "0001_initial"
down_revision = None
def upgrade():
    op.create_table("users", sa.Column("id", sa.String(), primary_key=True), sa.Column("email", sa.String(), nullable=False, unique=True), sa.Column("password_hash", sa.String()), sa.Column("password_salt", sa.String()), sa.Column("auth_provider", sa.String(), nullable=False), sa.Column("email_verified_at", sa.String()), sa.Column("created_at", sa.String(), nullable=False))
    op.create_table("auth_sessions", sa.Column("id", sa.String(), primary_key=True), sa.Column("user_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("token_hash", sa.String(), nullable=False, unique=True), sa.Column("expires_at", sa.Integer(), nullable=False), sa.Column("created_at", sa.String(), nullable=False))
    op.create_table("auth_tokens", sa.Column("id", sa.String(), primary_key=True), sa.Column("user_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("purpose", sa.String(), nullable=False), sa.Column("token_hash", sa.String(), nullable=False, unique=True), sa.Column("expires_at", sa.Integer(), nullable=False), sa.Column("used_at", sa.String()), sa.Column("created_at", sa.String(), nullable=False))
    op.create_table("auth_rate_limits", sa.Column("key", sa.String(), primary_key=True), sa.Column("attempts", sa.Integer(), nullable=False), sa.Column("expires_at", sa.Integer(), nullable=False))
    op.create_table("character_vaults", sa.Column("user_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True), sa.Column("vault_json", sa.Text(), nullable=False), sa.Column("updated_at", sa.String(), nullable=False))
def downgrade():
    op.drop_table("character_vaults"); op.drop_table("auth_rate_limits"); op.drop_table("auth_tokens"); op.drop_table("auth_sessions"); op.drop_table("users")
