import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from ..auth.dependencies import current_user
from ..config import settings
from ..database import get_db
from ..models import CharacterVault, User
from ..schemas import VaultRequest
from ..services.users import ensure_chatgpt_user

router = APIRouter(prefix="/api/vault")
def signed_in(request: Request, db: Session) -> User:
    try: return current_user(request, db)
    except Exception:
        email = request.headers.get("oai-authenticated-user-email")
        if not email: raise HTTPException(401, "Требуется вход")
        return ensure_chatgpt_user(db, email)
def validate(value):
    if not isinstance(value, dict) or value.get("version") != 1 or not isinstance(value.get("slots"), list) or not isinstance(value.get("activeId"), str) or not isinstance(value.get("capacity"), (int, float)): raise HTTPException(400, "Некорректная коллекция персонажей")
    if any(not isinstance(slot, dict) or not isinstance(slot.get("id"), str) or not isinstance(slot.get("updatedAt"), str) or not slot.get("character") for slot in value["slots"]): raise HTTPException(400, "Некорректная запись персонажа")
    raw = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if len(raw.encode()) > settings.vault_max_bytes: raise HTTPException(413, "Коллекция слишком велика")
    return raw
@router.get("")
def get_vault(request: Request, db: Session = Depends(get_db)):
    user = signed_in(request, db); row = db.get(CharacterVault, user.id); return {"vault": json.loads(row.vault_json) if row else None, "updatedAt": row.updated_at if row else None}
@router.put("")
def put_vault(payload: VaultRequest, request: Request, db: Session = Depends(get_db)):
    user = signed_in(request, db); raw = validate(payload.vault); updated = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"); row = db.get(CharacterVault, user.id)
    if row: row.vault_json, row.updated_at = raw, updated
    else: db.add(CharacterVault(user_id=user.id, vault_json=raw, updated_at=updated))
    db.commit(); return {"saved": True, "updatedAt": updated}
