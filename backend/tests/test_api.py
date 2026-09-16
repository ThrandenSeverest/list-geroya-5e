import json
import os
os.environ["DATABASE_URL"] = "sqlite:///./test.db"; os.environ["COOKIE_SECURE"] = "false"
from fastapi.testclient import TestClient
from app.database import Base, engine, SessionLocal
from app.main import app
from app.auth.security import hash_password, hash_token
from app.models import User, AuthSession, CharacterVault, HomebrewEntity, HomebrewLibrary
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

def test_homebrew_is_private_and_validated():
    anonymous=TestClient(app)
    assert anonymous.get("/api/homebrew").status_code==401
    client.post("/api/auth/login",json={"email":"a@example.test","password":"very-long-pass"})
    library={"version":1,"elements":[{"id":"hb-1","type":"spell","name":"Искра","description":"Авторское заклинание","updatedAt":"2026-09-15T00:00:00Z"}]}
    assert client.put("/api/homebrew",json={"library":library}).json()["saved"]
    assert client.get("/api/homebrew").json()["library"]==library
    assert client.put("/api/homebrew",json={"library":{"version":1,"elements":[{"id":"x","type":"race","name":"Нет","updatedAt":"2026-09-15T00:00:00Z"}]}}).status_code==400

def test_vault_is_compacted_and_legacy_rows_remain_readable():
    client.post("/api/auth/login",json={"email":"a@example.test","password":"very-long-pass"})
    large={**VAULT,"slots":[{**VAULT["slots"][0],"character":{"name":"A","notes":"Повтор " * 1000}}]}
    assert client.put("/api/vault",json={"vault":large}).status_code==200
    db=SessionLocal(); row=db.query(CharacterVault).filter_by(user_id=db.query(User).filter_by(email="a@example.test").one().id).one()
    assert row.vault_json=="{}" and row.payload_codec=="zlib-json" and len(row.compact_payload)<len(json.dumps(large).encode())
    row.compact_payload=None; row.payload_codec=None; row.vault_json=json.dumps(VAULT); db.commit(); db.close()
    assert client.get("/api/vault").json()["vault"]==VAULT

def test_vault_limits_and_embedded_binary():
    client.post("/api/auth/login",json={"email":"a@example.test","password":"very-long-pass"})
    too_many={**VAULT,"slots":[{**VAULT["slots"][0],"id":str(i)} for i in range(101)]}
    assert client.put("/api/vault",json={"vault":too_many}).status_code==413
    embedded={**VAULT,"slots":[{**VAULT["slots"][0],"character":{"portrait":"data:image/png;base64,AAAA"}}]}
    assert client.put("/api/vault",json={"vault":embedded}).status_code==413

def test_homebrew_entities_are_normalized_ordered_and_limited():
    client.post("/api/auth/login",json={"email":"a@example.test","password":"very-long-pass"})
    elements=[
        {"id":"second","type":"note","name":"Второй","description":"x" * 3000,"updatedAt":"2026-09-15T00:00:02Z"},
        {"id":"first","type":"ability","name":"Первый","description":"y","updatedAt":"2026-09-15T00:00:01Z"},
    ]
    library={"version":1,"elements":elements}
    assert client.put("/api/homebrew",json={"library":library}).status_code==200
    assert client.get("/api/homebrew").json()["library"]==library
    db=SessionLocal(); rows=db.query(HomebrewEntity).order_by(HomebrewEntity.sort_index).all()
    assert [row.id for row in rows]==["second","first"] and rows[0].payload_codec=="zlib-json"
    assert db.query(HomebrewLibrary).one().library_json=="{}"; db.close()
    too_many={"version":1,"elements":[{"id":str(i),"type":"note","name":"N","updatedAt":"2026-09-15T00:00:00Z"} for i in range(101)]}
    assert client.put("/api/homebrew",json={"library":too_many}).status_code==413
