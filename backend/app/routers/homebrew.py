import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..auth.dependencies import current_user
from ..config import settings
from ..database import get_db
from ..models import HomebrewEntity, HomebrewLibrary, User
from ..schemas import HomebrewRequest
from ..services.payloads import decode_payload, encode_payload, json_bytes, payload_hash, reject_embedded_binary
from ..services.users import ensure_chatgpt_user
from .vault import rate_limit

router = APIRouter(prefix="/api/homebrew")
ALLOWED_TYPES = {"ability", "feat", "item", "spell", "proficiency", "race", "subrace", "class", "subclass", "background", "resource", "attack", "table", "note", "pack"}


def signed_in(request: Request, db: Session) -> User:
    try:
        return current_user(request, db)
    except HTTPException as error:
        if error.status_code != 401:
            raise
        email = request.headers.get("oai-authenticated-user-email")
        if not email:
            raise HTTPException(401, "Требуется вход")
        return ensure_chatgpt_user(db, email)


def validate(value):
    if not isinstance(value, dict) or value.get("version") not in (1, 2) or not isinstance(value.get("elements"), list):
        raise HTTPException(400, "Некорректная библиотека хоумбрю")
    if len(value["elements"]) > settings.homebrew_max_count:
        raise HTTPException(413, f"Можно хранить не более {settings.homebrew_max_count} элементов хоумбрю")
    reject_embedded_binary(value)
    encoded = []
    total = 0
    ids = set()
    for element in value["elements"]:
        if not isinstance(element, dict) or not isinstance(element.get("id"), str) or element["id"] in ids:
            raise HTTPException(400, "Некорректный или повторяющийся id пользовательского элемента")
        ids.add(element["id"])
        if element.get("type") not in ALLOWED_TYPES or not isinstance(element.get("name"), str) or not element["name"].strip():
            raise HTTPException(400, "Некорректный тип или название пользовательского элемента")
        if not isinstance(element.get("description", ""), str) or not isinstance(element.get("updatedAt"), str):
            raise HTTPException(400, "Некорректное описание пользовательского элемента")
        if element.get("characterId") is not None and not isinstance(element.get("characterId"), str):
            raise HTTPException(400, "Некорректная привязка пользовательского элемента")
        raw = json_bytes(element)
        total += len(raw)
        if len(raw) > settings.homebrew_entity_max_bytes:
            raise HTTPException(413, "Один элемент хоумбрю превышает лимит 32 КиБ")
        encoded.append((element, raw))
    if total > settings.homebrew_total_max_bytes:
        raise HTTPException(413, "Библиотека хоумбрю превышает лимит 2 МиБ")
    return encoded


@router.get("")
def get_homebrew(request: Request, db: Session = Depends(get_db)):
    user = signed_in(request, db)
    rows = list(db.scalars(select(HomebrewEntity).where(HomebrewEntity.owner_user_id == user.id).order_by(HomebrewEntity.sort_index)))
    if rows:
        elements = [decode_payload(row.payload_codec, row.content_blob) for row in rows]
        return {"library": {"version": 2, "schemaVersion": 2, "elements": elements}, "updatedAt": max(row.updated_at for row in rows)}
    legacy = db.get(HomebrewLibrary, user.id)
    if legacy and legacy.library_json not in {"", "{}"}:
        return {"library": json.loads(legacy.library_json), "updatedAt": legacy.updated_at}
    return {"library": {"version": 2, "schemaVersion": 2, "elements": []}, "updatedAt": legacy.updated_at if legacy else None}


@router.put("")
def put_homebrew(payload: HomebrewRequest, request: Request, db: Session = Depends(get_db)):
    user = signed_in(request, db)
    encoded = validate(payload.library)
    rate_limit(db, user.id, "write", 30, 60)
    updated = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    db.execute(delete(HomebrewEntity).where(HomebrewEntity.owner_user_id == user.id))
    for sort_index, (element, raw) in enumerate(encoded):
        codec, compact = encode_payload(raw)
        db.add(HomebrewEntity(owner_user_id=user.id, id=element["id"], kind=element["type"], name=element["name"].strip(), sort_index=sort_index, schema_version=element.get("schemaVersion", 1), payload_codec=codec, content_blob=compact, content_hash=payload_hash(raw), updated_at=element["updatedAt"] or updated))
    legacy = db.get(HomebrewLibrary, user.id)
    if legacy:
        legacy.library_json = "{}"
        legacy.updated_at = updated
    else:
        db.add(HomebrewLibrary(user_id=user.id, library_json="{}", updated_at=updated))
    db.commit()
    return {"saved": True, "updatedAt": updated}

