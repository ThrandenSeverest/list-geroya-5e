from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..auth.dependencies import current_session, current_user
from ..config import settings
from ..database import get_db
from ..models import User, UserExternalIdentity
from ..services.users import ensure_chatgpt_user

router = APIRouter()
@router.get("/api/account")
def account(request: Request, db: Session = Depends(get_db)):
    try:
        user = current_user(request, db)
        linked = list(db.scalars(select(UserExternalIdentity.provider).where(UserExternalIdentity.user_id == user.id)))
        return {"authenticated": True, "email": user.email, "displayName": user.email, "emailVerified": bool(user.email_verified_at), "authProvider": user.auth_provider, "linkedProviders": linked, "authConfig": settings.public_auth_config()}
    except Exception:
        try:
            session = current_session(request, db)
            user = db.get(User, session.user_id)
            if session.scope == "legacy_recovery" and user:
                return {"authenticated": False, "legacyRecovery": True, "email": user.email, "authProvider": "email", "authConfig": settings.public_auth_config()}
        except Exception:
            pass
        email = request.headers.get("oai-authenticated-user-email")
        if not email: return {"authenticated": False, "authConfig": settings.public_auth_config()}
        user = ensure_chatgpt_user(db, email); name = request.headers.get("oai-authenticated-user-full-name") or email
        return {"authenticated": True, "email": user.email, "displayName": name, "emailVerified": True, "authProvider": "chatgpt", "authConfig": settings.public_auth_config()}
