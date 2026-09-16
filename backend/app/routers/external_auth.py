import uuid
import httpx
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..auth.security import now_iso
from ..config import settings
from ..database import get_db
from ..auth.dependencies import linkable_user
from ..models import CharacterVault, HomebrewEntity, HomebrewLibrary, User, UserExternalIdentity
from ..services.sessions import create_session, set_session_cookie

router = APIRouter(prefix="/api/auth/external")

class PlatformBody(BaseModel):
    platform: str

class TokenBody(BaseModel):
    token: str

def platform(value: str) -> str:
    if value not in {"telegram", "vk", "max"}:
        raise HTTPException(400, "Неизвестная платформа")
    return value

@router.post("/start")
async def start(body: PlatformBody):
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(f"{settings.external_auth_base}/start", json={"platform": platform(body.platform)})
    if response.status_code >= 400: raise HTTPException(response.status_code, "Не удалось начать авторизацию")
    return response.json()

@router.get("/status")
async def status(code: str, platform_name: str):
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(f"{settings.external_auth_base}/status", params={"code": code, "platform": platform(platform_name)})
    if response.status_code >= 400: raise HTTPException(response.status_code, "Не удалось проверить авторизацию")
    return response.json()

async def verified_identity(token: str) -> tuple[str, str, dict]:
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(f"{settings.external_auth_base}/verify", json={"token": token})
    if response.status_code != 200: raise HTTPException(401, "Токен авторизации недействителен или истёк")
    payload = response.json().get("payload") or {}
    provider, user_hash = platform(payload.get("platform", "")), payload.get("user_hash", "")
    if not user_hash: raise HTTPException(401, "Сервис авторизации не вернул идентификатор")
    return provider, user_hash, payload

def identity_user(db: Session, provider: str, user_hash: str) -> User | None:
    identity = db.get(UserExternalIdentity, {"provider": provider, "external_user_hash": user_hash})
    if identity:
        return db.get(User, identity.user_id)
    # Compatibility before/after migration of Telegram accounts created by the old code.
    legacy = db.scalar(select(User).where(User.email == f"{provider}:{user_hash}@external.invalid"))
    if legacy:
        db.add(UserExternalIdentity(provider=provider, external_user_hash=user_hash, user_id=legacy.id, created_at=now_iso()))
        db.commit()
    return legacy

def session_response(db: Session, user: User, provider: str, payload: dict) -> Response:
    result = {"authenticated": True, "authProvider": provider, "externalName": payload.get("external_name"), "userHash": payload.get("user_hash")}
    response_out = Response(content=__import__("json").dumps(result, ensure_ascii=False), media_type="application/json")
    set_session_cookie(response_out, create_session(db, user.id)); return response_out

@router.post("/complete")
async def complete(body: TokenBody, db: Session = Depends(get_db)):
    provider, user_hash, payload = await verified_identity(body.token)
    user = identity_user(db, provider, user_hash)
    if not user:
        user = User(id=str(uuid.uuid4()), email=f"{provider}:{user_hash}@external.invalid", password_hash=None, password_salt=None, auth_provider=provider, email_verified_at=now_iso(), created_at=now_iso())
        db.add(user); db.flush()
        db.add(UserExternalIdentity(provider=provider, external_user_hash=user_hash, user_id=user.id, created_at=now_iso()))
        db.commit()
    return session_response(db, user, provider, payload)

@router.post("/link")
async def link(body: TokenBody, user: User = Depends(linkable_user), db: Session = Depends(get_db)):
    """Attach Telegram to the current E-mail user without changing that user's id."""
    if user.auth_provider != "email": raise HTTPException(409, "Привязка предназначена для старого E-mail аккаунта")
    provider, user_hash, payload = await verified_identity(body.token)
    if provider != "telegram": raise HTTPException(400, "Для переноса аккаунта поддерживается только Telegram")
    existing = identity_user(db, provider, user_hash)
    if existing and existing.id != user.id:
        has_data = bool(db.get(CharacterVault, existing.id)) or bool(db.get(HomebrewLibrary, existing.id)) or bool(db.scalar(select(HomebrewEntity).where(HomebrewEntity.owner_user_id == existing.id)))
        if has_data:
            raise HTTPException(409, "У этого Telegram уже есть отдельные данные. Сначала экспортируйте их; автоматическое объединение запрещено, чтобы ничего не потерять.")
        old_identity = db.get(UserExternalIdentity, {"provider": provider, "external_user_hash": user_hash})
        if old_identity:
            db.delete(old_identity)
            db.flush()
        db.delete(existing)
        db.flush()
    identity = db.get(UserExternalIdentity, {"provider": provider, "external_user_hash": user_hash})
    if identity:
        identity.user_id = user.id
    else:
        db.add(UserExternalIdentity(provider=provider, external_user_hash=user_hash, user_id=user.id, created_at=now_iso()))
    db.commit()
    return session_response(db, user, provider, payload)
