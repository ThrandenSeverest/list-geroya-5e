import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth.dependencies import recovery_user
from ..database import get_db
from ..models import CharacterVault, HomebrewEntity, HomebrewLibrary, User
from ..services.payloads import decode_payload
from .vault import load_vault

router = APIRouter(prefix="/api/legacy")


@router.get("/export")
def export_legacy(user: User = Depends(recovery_user), db: Session = Depends(get_db)):
    vault_row = db.get(CharacterVault, user.id)
    rows = list(db.scalars(select(HomebrewEntity).where(HomebrewEntity.owner_user_id == user.id).order_by(HomebrewEntity.sort_index)))
    if rows:
        homebrew = {"version": 1, "elements": [decode_payload(row.payload_codec, row.content_blob) for row in rows]}
    else:
        legacy = db.get(HomebrewLibrary, user.id)
        homebrew = json.loads(legacy.library_json) if legacy and legacy.library_json not in {"", "{}"} else {"version": 1, "elements": []}
    exported = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    payload = {"format": "herolist-legacy-backup", "version": 1, "exportedAt": exported, "email": user.email, "vault": load_vault(vault_row), "homebrew": homebrew}
    return JSONResponse(payload, headers={"Content-Disposition": 'attachment; filename="herolist-legacy-backup.json"'})
