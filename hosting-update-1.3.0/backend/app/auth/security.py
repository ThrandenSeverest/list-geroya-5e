import base64, hashlib, hmac, secrets
from . import __name__
from ..config import settings

AUTH_COOKIE = "list_geroya_session"
def now_iso():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
def random_token(bytes_count=32):
    return base64.urlsafe_b64encode(secrets.token_bytes(bytes_count)).rstrip(b"=").decode()
def hash_token(token: str): return hashlib.sha256(token.encode()).hexdigest()
def normalize_email(value: str): return value.strip().lower()
def hash_password(password: str, salt: str | None = None):
    salt = salt or random_token(16)
    value = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), settings.password_iterations, dklen=32).hex()
    return {"salt": salt, "hash": value}
def verify_password(password: str, salt: str, expected: str):
    return hmac.compare_digest(hash_password(password, salt)["hash"], expected)
