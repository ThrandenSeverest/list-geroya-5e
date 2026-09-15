import os
os.environ["DATABASE_URL"] = "sqlite:///./test.db"; os.environ["COOKIE_SECURE"] = "false"
from fastapi.testclient import TestClient
from app.database import Base, engine, SessionLocal
from app.main import app
from app.auth.security import hash_password, hash_token
from app.models import User, AuthSession
Base.metadata.drop_all(engine); Base.metadata.create_all(engine); client=TestClient(app)
VAULT={"version":1,"capacity":5,"activeId":"a","slots":[{"id":"a","updatedAt":"2026-01-01T00:00:00Z","character":{"name":"A"}}]}
def test_register_login_vault_logout():
    r=client.post("/api/auth/register",json={"email":"a@example.test","password":"very-long-pass"}); assert r.status_code==201 and "list_geroya_session" in r.headers["set-cookie"]
    assert client.get("/api/account").json()["authenticated"]
    assert client.put("/api/vault",json={"vault":VAULT}).json()["saved"]
    assert client.get("/api/vault").json()["vault"]==VAULT
    assert client.post("/api/auth/logout").json()=={"authenticated":False}
    assert client.get("/api/vault").status_code==401
def test_legacy_pbkdf2_login():
    db=SessionLocal(); digest=hash_password("old-password", "legacy-salt"); db.add(User(id="legacy",email="legacy@example.test",password_hash=digest["hash"],password_salt="legacy-salt",auth_provider="email",email_verified_at="2026-01-01T00:00:00Z",created_at="2026-01-01T00:00:00Z")); db.commit(); db.close()
    assert client.post("/api/auth/login",json={"email":"legacy@example.test","password":"old-password"}).status_code==200
def test_invalid_vault():
    client.post("/api/auth/login",json={"email":"a@example.test","password":"very-long-pass"})
    assert client.put("/api/vault",json={"vault":{"version":2}}).status_code==400
def test_migrated_session_and_empty_vault():
    db=SessionLocal(); db.add(User(id="session-user",email="session@example.test",password_hash=None,password_salt=None,auth_provider="chatgpt",email_verified_at="2026-01-01T00:00:00Z",created_at="2026-01-01T00:00:00Z")); db.commit(); db.add(AuthSession(id="session-id",user_id="session-user",token_hash=hash_token("existing-session-token"),expires_at=4102444800,created_at="2026-01-01T00:00:00Z")); db.commit(); db.close()
    isolated=TestClient(app); isolated.cookies.set("list_geroya_session","existing-session-token")
    assert isolated.get("/api/account").json()["email"]=="session@example.test"
    assert isolated.get("/api/vault").json()=={"vault":None,"updatedAt":None}
