import uuid
import httpx
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..auth.security import now_iso
from ..config import settings
from ..database import get_db
from ..models import User
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

@router.post("/complete")
async def complete(body: TokenBody, db: Session = Depends(get_db)):
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(f"{settings.external_auth_base}/verify", json={"token": body.token})
    if response.status_code != 200: raise HTTPException(401, "Токен авторизации недействителен или истёк")
    payload = response.json().get("payload") or {}
    provider, user_hash = platform(payload.get("platform", "")), payload.get("user_hash", "")
    if not user_hash: raise HTTPException(401, "Сервис авторизации не вернул идентификатор")
    external_key = f"{provider}:{user_hash}"
    user = db.scalar(select(User).where(User.email == f"{external_key}@external.invalid"))
    if not user:
        user = User(id=str(uuid.uuid4()), email=f"{external_key}@external.invalid", password_hash=None, password_salt=None, auth_provider=provider, email_verified_at=now_iso(), created_at=now_iso())
        db.add(user); db.commit()
    result = {"authenticated": True, "authProvider": provider, "externalName": payload.get("external_name"), "userHash": user_hash}
    response_out = Response(content=__import__("json").dumps(result, ensure_ascii=False), media_type="application/json")
    set_session_cookie(response_out, create_session(db, user.id)); return response_out
