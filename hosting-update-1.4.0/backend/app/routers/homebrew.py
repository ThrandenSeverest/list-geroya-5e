import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..auth.dependencies import current_user
from ..config import settings
from ..database import get_db
from ..models import HomebrewLibrary, User
from ..schemas import HomebrewRequest
from ..services.users import ensure_chatgpt_user

router = APIRouter(prefix="/api/homebrew")
ALLOWED_TYPES = {"ability", "item", "spell", "proficiency", "note"}


def signed_in(request: Request, db: Session) -> User:
    try:
        return current_user(request, db)
    except Exception:
        email = request.headers.get("oai-authenticated-user-email")
        if not email:
            raise HTTPException(401, "Требуется вход")
        return ensure_chatgpt_user(db, email)


def validate(value):
    if not isinstance(value, dict) or value.get("version") != 1 or not isinstance(value.get("elements"), list):
        raise HTTPException(400, "Некорректная библиотека хоумбрю")
    for element in value["elements"]:
        if not isinstance(element, dict) or not isinstance(element.get("id"), str):
            raise HTTPException(400, "Некорректный пользовательский элемент")
        if element.get("type") not in ALLOWED_TYPES or not isinstance(element.get("name"), str) or not element["name"].strip():
            raise HTTPException(400, "Некорректный тип или название пользовательского элемента")
        if not isinstance(element.get("description", ""), str) or not isinstance(element.get("updatedAt"), str):
            raise HTTPException(400, "Некорректное описание пользовательского элемента")
        character_id = element.get("characterId")
        if character_id is not None and not isinstance(character_id, str):
            raise HTTPException(400, "Некорректная привязка пользовательского элемента")
    raw = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if len(raw.encode()) > settings.vault_max_bytes:
        raise HTTPException(413, "Библиотека хоумбрю слишком велика")
    return raw


@router.get("")
def get_homebrew(request: Request, db: Session = Depends(get_db)):
    user = signed_in(request, db)
    row = db.get(HomebrewLibrary, user.id)
    return {"library": json.loads(row.library_json) if row else {"version": 1, "elements": []}, "updatedAt": row.updated_at if row else None}


@router.put("")
def put_homebrew(payload: HomebrewRequest, request: Request, db: Session = Depends(get_db)):
    user = signed_in(request, db)
    raw = validate(payload.library)
    updated = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    row = db.get(HomebrewLibrary, user.id)
    if row:
        row.library_json, row.updated_at = raw, updated
    else:
        db.add(HomebrewLibrary(user_id=user.id, library_json=raw, updated_at=updated))
    db.commit()
    return {"saved": True, "updatedAt": updated}
