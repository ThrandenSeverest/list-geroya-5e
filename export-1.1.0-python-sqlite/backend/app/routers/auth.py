import time, uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import delete, select
from sqlalchemy.orm import Session
from ..auth.dependencies import current_user
from ..auth.security import hash_password, hash_token, normalize_email, now_iso, random_token, AUTH_COOKIE
from ..config import settings
from ..database import get_db
from ..models import AuthRateLimit, AuthSession, AuthToken, User
from ..schemas import Credentials, TokenPassword
from ..services.email import send_email
from ..services.sessions import create_session, set_session_cookie

router = APIRouter(prefix="/api/auth")

def rate_limit(request: Request, db: Session, scope: str, limit: int, window: int):
    ip = request.headers.get("cf-connecting-ip") or request.headers.get("x-forwarded-for", "unknown").split(",")[0].strip()
    bucket = int(time.time() / window); key = f"{scope}:{ip}:{bucket}"; row = db.get(AuthRateLimit, key)
    if row: row.attempts += 1
    else: db.add(AuthRateLimit(key=key, attempts=1, expires_at=(bucket + 1) * window))
    db.commit()
    if (row.attempts if row else 1) > limit: raise HTTPException(429, "Слишком много попыток. Попробуйте позже.", headers={"Retry-After": str(window)})

def issue_token(db: Session, user_id: str, purpose: str, ttl: int):
    token = random_token(); db.add(AuthToken(id=str(uuid.uuid4()), user_id=user_id, purpose=purpose, token_hash=hash_token(token), expires_at=int(time.time()) + ttl, created_at=now_iso())); db.commit(); return token

def base_url(request: Request): return settings.app_base_url or str(request.base_url).rstrip("/")

@router.post("/register")
async def register(body: Credentials, request: Request, db: Session = Depends(get_db)):
    if not settings.registration_enabled: raise HTTPException(403, "Регистрация временно отключена")
    rate_limit(request, db, "register", 5, 900)
    email, password = normalize_email(body.email), body.password
    if not __import__("re").match(r"^\S+@\S+\.\S+$", email): raise HTTPException(400, "Введите корректную почту")
    if not 10 <= len(password) <= 128: raise HTTPException(400, "Пароль должен содержать от 10 до 128 символов")
    if db.scalar(select(User).where(User.email == email)): raise HTTPException(409, "Не удалось создать аккаунт с этими данными")
    digest = hash_password(password); user = User(id=str(uuid.uuid4()), email=email, password_hash=digest["hash"], password_salt=digest["salt"], auth_provider="email", email_verified_at=None if settings.email_verification_enabled else now_iso(), created_at=now_iso()); db.add(user); db.commit()
    sent = False
    if settings.email_verification_enabled:
        token = issue_token(db, user.id, "verify_email", 86400); url = f"{base_url(request)}/api/auth/verify-email?token={token}"; sent = await send_email(email, "Подтверждение почты — Лист Героя 5e", f'<p>Подтвердите почту:</p><p><a href="{url}">{url}</a></p>')
    response = Response(content=__import__("json").dumps({"authenticated": True, "email": email, "emailVerified": not settings.email_verification_enabled, "emailSent": sent}), status_code=201, media_type="application/json"); set_session_cookie(response, create_session(db, user.id)); return response

@router.post("/login")
def login(body: Credentials, request: Request, db: Session = Depends(get_db)):
    if not settings.login_enabled: raise HTTPException(403, "Вход временно отключён")
    rate_limit(request, db, "login", 10, 900); user = db.scalar(select(User).where(User.email == normalize_email(body.email), User.auth_provider == "email"))
    from ..auth.security import verify_password
    if not user or not user.password_hash or not user.password_salt or not verify_password(body.password, user.password_salt, user.password_hash): raise HTTPException(401, "Неверная почта или пароль")
    if settings.require_verified_email and not user.email_verified_at: raise HTTPException(403, "Сначала подтвердите почту")
    response = Response(content=__import__("json").dumps({"authenticated": True, "email": user.email, "emailVerified": bool(user.email_verified_at)}), media_type="application/json"); set_session_cookie(response, create_session(db, user.id)); return response

@router.post("/logout")
def logout(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get(AUTH_COOKIE)
    if token: db.execute(delete(AuthSession).where(AuthSession.token_hash == hash_token(token))); db.commit()
    response = Response(content='{"authenticated":false}', media_type="application/json"); set_session_cookie(response, "", 0); return response

@router.post("/forgot-password")
async def forgot_password(body: Credentials, request: Request, db: Session = Depends(get_db)):
    if not settings.password_reset_enabled: raise HTTPException(403, "Восстановление пароля отключено")
    if not settings.email_delivery_configured: raise HTTPException(503, detail={"error": "Восстановление через письмо пока не подключено", "emailDeliveryEnabled": False})
    rate_limit(request, db, "forgot", 4, 3600); user = db.scalar(select(User).where(User.email == normalize_email(body.email), User.auth_provider == "email"))
    if user:
        token = issue_token(db, user.id, "reset_password", 3600); url = f"{base_url(request)}/account?reset_token={token}"; await send_email(user.email, "Сброс пароля — Лист Героя 5e", f'<p>Ссылка действует 1 час:</p><p><a href="{url}">{url}</a></p>')
    return {"sent": True}

@router.post("/reset-password")
def reset_password(body: TokenPassword, db: Session = Depends(get_db)):
    if not body.token or not 10 <= len(body.password) <= 128: raise HTTPException(400, "Некорректная ссылка или пароль")
    row = db.scalar(select(AuthToken).where(AuthToken.token_hash == hash_token(body.token), AuthToken.purpose == "reset_password", AuthToken.used_at.is_(None), AuthToken.expires_at > int(time.time())))
    if not row: raise HTTPException(400, "Ссылка недействительна или устарела")
    user = db.get(User, row.user_id); digest = hash_password(body.password); user.password_hash, user.password_salt, row.used_at = digest["hash"], digest["salt"], now_iso(); db.execute(delete(AuthSession).where(AuthSession.user_id == user.id)); db.commit(); return {"reset": True}

@router.get("/verify-email")
def verify_email(token: str | None = None, db: Session = Depends(get_db)):
    row = db.scalar(select(AuthToken).where(AuthToken.token_hash == hash_token(token or ""), AuthToken.purpose == "verify_email", AuthToken.used_at.is_(None), AuthToken.expires_at > int(time.time())))
    if not row: return RedirectResponse("/account?verified=invalid")
    db.get(User, row.user_id).email_verified_at = now_iso(); row.used_at = now_iso(); db.commit(); return RedirectResponse("/account?verified=success")

@router.post("/resend-verification")
async def resend_verification(request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not (settings.email_verification_enabled and settings.email_delivery_configured): raise HTTPException(503, "Подтверждение почты пока отключено")
    rate_limit(request, db, "verify", 3, 3600)
    if user.email_verified_at: return {"sent": True}
    threshold = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat().replace("+00:00", "Z")
    recent = db.scalar(select(AuthToken).where(AuthToken.user_id == user.id, AuthToken.purpose == "verify_email", AuthToken.used_at.is_(None), AuthToken.created_at > threshold))
    if recent: raise HTTPException(429, "Новое письмо можно запросить через 10 минут")
    token = issue_token(db, user.id, "verify_email", 86400); url = f"{base_url(request)}/api/auth/verify-email?token={token}"; return {"sent": await send_email(user.email, "Подтверждение почты — Лист Героя 5e", f'<a href="{url}">{url}</a>')}
