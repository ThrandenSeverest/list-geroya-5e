import time
from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import AuthSession, User
from .security import AUTH_COOKIE, hash_token

def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(AUTH_COOKIE)
    if not token: raise HTTPException(401, "Требуется вход")
    session = db.scalar(select(AuthSession).where(AuthSession.token_hash == hash_token(token), AuthSession.expires_at > int(time.time())))
    user = db.get(User, session.user_id) if session else None
    if not user: raise HTTPException(401, "Требуется вход")
    return user
