import time, uuid
from fastapi import Response
from sqlalchemy.orm import Session
from ..auth.security import AUTH_COOKIE, hash_token, now_iso, random_token
from ..config import settings
from ..models import AuthSession

def create_session(db: Session, user_id: str) -> str:
    token = random_token(); db.add(AuthSession(id=str(uuid.uuid4()), user_id=user_id, token_hash=hash_token(token), expires_at=int(time.time()) + settings.session_days * 86400, created_at=now_iso())); db.commit(); return token
def set_session_cookie(response: Response, token: str, max_age: int | None = None):
    response.set_cookie(AUTH_COOKIE, token, max_age=settings.session_days * 86400 if max_age is None else max_age, path="/", httponly=True, secure=settings.cookie_secure, samesite="lax")
