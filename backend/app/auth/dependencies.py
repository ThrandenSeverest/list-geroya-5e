import time
from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import AuthSession, User
from .security import AUTH_COOKIE, hash_token

def current_session(request: Request, db: Session) -> AuthSession:
    token = request.cookies.get(AUTH_COOKIE)
    if not token: raise HTTPException(401, "Требуется вход")
    session = db.scalar(select(AuthSession).where(AuthSession.token_hash == hash_token(token), AuthSession.expires_at > int(time.time())))
    if not session: raise HTTPException(401, "Требуется вход")
    return session

def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    session = current_session(request, db)
    if session.scope != "full": raise HTTPException(403, "Recovery-сессия разрешает только экспорт и привязку Telegram")
    user = db.get(User, session.user_id)
    if not user: raise HTTPException(401, "Требуется вход")
    return user

def recovery_user(request: Request, db: Session = Depends(get_db)) -> User:
    session = current_session(request, db)
    if session.scope != "legacy_recovery": raise HTTPException(403, "Требуется legacy recovery-сессия")
    user = db.get(User, session.user_id)
    if not user or user.auth_provider != "email": raise HTTPException(401, "Требуется старый E-mail аккаунт")
    return user

def linkable_user(request: Request, db: Session = Depends(get_db)) -> User:
    session = current_session(request, db)
    if session.scope not in {"full", "legacy_recovery"}: raise HTTPException(403, "Эта сессия не поддерживает привязку")
    user = db.get(User, session.user_id)
    if not user: raise HTTPException(401, "Требуется вход")
    return user
