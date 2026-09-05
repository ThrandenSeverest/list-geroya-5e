import uuid
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..auth.security import normalize_email, now_iso
from ..models import User

def ensure_chatgpt_user(db: Session, email_value: str) -> User:
    email = normalize_email(email_value)
    user = db.scalar(select(User).where(User.email == email))
    if user: return user
    user = User(id=str(uuid.uuid4()), email=email, auth_provider="chatgpt", email_verified_at=now_iso(), created_at=now_iso())
    db.add(user); db.commit(); return user
