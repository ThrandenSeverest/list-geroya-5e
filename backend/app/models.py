from sqlalchemy import ForeignKey, Integer, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base

class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String)
    password_salt: Mapped[str | None] = mapped_column(String)
    auth_provider: Mapped[str] = mapped_column(String, nullable=False, default="email")
    email_verified_at: Mapped[str | None] = mapped_column(String)
    created_at: Mapped[str] = mapped_column(String, nullable=False)

class AuthSession(Base):
    __tablename__ = "auth_sessions"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    expires_at: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[str] = mapped_column(String, nullable=False)

class AuthToken(Base):
    __tablename__ = "auth_tokens"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    purpose: Mapped[str] = mapped_column(String, nullable=False)
    token_hash: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    expires_at: Mapped[int] = mapped_column(Integer, nullable=False)
    used_at: Mapped[str | None] = mapped_column(String)
    created_at: Mapped[str] = mapped_column(String, nullable=False)

class AuthRateLimit(Base):
    __tablename__ = "auth_rate_limits"
    key: Mapped[str] = mapped_column(String, primary_key=True)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    expires_at: Mapped[int] = mapped_column(Integer, nullable=False)

class CharacterVault(Base):
    __tablename__ = "character_vaults"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    vault_json: Mapped[str] = mapped_column(Text, nullable=False)
    schema_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    payload_codec: Mapped[str | None] = mapped_column(String)
    compact_payload: Mapped[bytes | None] = mapped_column(LargeBinary)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)

class HomebrewLibrary(Base):
    __tablename__ = "homebrew_libraries"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    library_json: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)

class HomebrewEntity(Base):
    __tablename__ = "homebrew_entities"
    owner_user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    id: Mapped[str] = mapped_column(String, primary_key=True)
    kind: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    sort_index: Mapped[int] = mapped_column(Integer, nullable=False)
    schema_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    payload_codec: Mapped[str] = mapped_column(String, nullable=False)
    content_blob: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    content_hash: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)
