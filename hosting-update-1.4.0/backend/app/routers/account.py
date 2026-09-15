from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from ..auth.dependencies import current_user
from ..config import settings
from ..database import get_db
from ..models import User
from ..services.users import ensure_chatgpt_user

router = APIRouter()
@router.get("/api/account")
def account(request: Request, db: Session = Depends(get_db)):
    try:
        user = current_user(request, db)
        return {"authenticated": True, "email": user.email, "displayName": user.email, "emailVerified": bool(user.email_verified_at), "authProvider": "email", "authConfig": settings.public_auth_config()}
    except Exception:
        email = request.headers.get("oai-authenticated-user-email")
        if not email: return {"authenticated": False, "authConfig": settings.public_auth_config()}
        user = ensure_chatgpt_user(db, email); name = request.headers.get("oai-authenticated-user-full-name") or email
        return {"authenticated": True, "email": user.email, "displayName": name, "emailVerified": True, "authProvider": "chatgpt", "authConfig": settings.public_auth_config()}
