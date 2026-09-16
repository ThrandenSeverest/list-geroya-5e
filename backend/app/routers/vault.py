import json
import time
import zlib
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..auth.dependencies import current_user
from ..config import settings
from ..database import get_db
from ..models import AuthRateLimit, CharacterVault, User
from ..schemas import VaultRequest
from ..services.payloads import decode_payload, encode_payload, json_bytes, reject_embedded_binary
from ..services.users import ensure_chatgpt_user

router = APIRouter(prefix="/api/vault")


def signed_in(request: Request, db: Session) -> User:
    try:
        return current_user(request, db)
    except Exception:
        email = request.headers.get("oai-authenticated-user-email")
        if not email:
            raise HTTPException(401, "Требуется вход")
        return ensure_chatgpt_user(db, email)


def rate_limit(db: Session, user_id: str, scope: str, limit: int, window: int) -> None:
    bucket = int(time.time() / window)
    key = f"storage:{scope}:{user_id}:{bucket}"
    row = db.get(AuthRateLimit, key)
    if row and row.attempts >= limit:
        raise HTTPException(429, "Слишком много операций. Попробуйте позже")
    if row:
        row.attempts += 1
    else:
        db.add(AuthRateLimit(key=key, attempts=1, expires_at=(bucket + 1) * window))


def load_vault(row: CharacterVault | None):
    if not row:
        return None
    if row.compact_payload:
        return decode_payload(row.payload_codec, row.compact_payload)
    return json.loads(row.vault_json)


def validate(value):
    if not isinstance(value, dict) or value.get("version") != 1 or not isinstance(value.get("slots"), list) or not isinstance(value.get("activeId"), str) or not isinstance(value.get("capacity"), (int, float)):
        raise HTTPException(400, "Некорректная коллекция персонажей")
    if len(value["slots"]) > settings.character_max_count:
        raise HTTPException(413, f"Можно хранить не более {settings.character_max_count} персонажей")
    reject_embedded_binary(value)
    for slot in value["slots"]:
        if not isinstance(slot, dict) or not isinstance(slot.get("id"), str) or not isinstance(slot.get("updatedAt"), str) or not isinstance(slot.get("character"), dict):
            raise HTTPException(400, "Некорректная запись персонажа")
        character_raw = json_bytes(slot["character"])
        if len(character_raw) > settings.character_raw_max_bytes:
            raise HTTPException(413, "Один персонаж превышает лимит 256 КиБ")
        if len(zlib.compress(character_raw, level=6)) > settings.character_compressed_max_bytes:
            raise HTTPException(413, "Сжатый персонаж превышает лимит 64 КиБ")
    raw = json_bytes(value)
    if len(raw) > settings.vault_max_bytes:
        raise HTTPException(413, "Коллекция слишком велика")
    return raw


@router.get("")
def get_vault(request: Request, db: Session = Depends(get_db)):
    user = signed_in(request, db)
    row = db.get(CharacterVault, user.id)
    return {"vault": load_vault(row), "updatedAt": row.updated_at if row else None}


@router.put("")
def put_vault(payload: VaultRequest, request: Request, db: Session = Depends(get_db)):
    user = signed_in(request, db)
    raw = validate(payload.vault)
    row = db.get(CharacterVault, user.id)
    previous = load_vault(row)
    rate_limit(db, user.id, "write", 30, 60)
    previous_ids = {slot.get("id") for slot in (previous or {}).get("slots", [])}
    incoming_ids = {slot.get("id") for slot in payload.vault["slots"]}
    if incoming_ids - previous_ids:
        rate_limit(db, user.id, "create", 20, 600)
    codec, compact = encode_payload(raw)
    updated = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    if row:
        row.vault_json = "{}"
        row.schema_version = 1
        row.payload_codec = codec
        row.compact_payload = compact
        row.updated_at = updated
    else:
        db.add(CharacterVault(user_id=user.id, vault_json="{}", schema_version=1, payload_codec=codec, compact_payload=compact, updated_at=updated))
    db.commit()
    return {"saved": True, "updatedAt": updated}
