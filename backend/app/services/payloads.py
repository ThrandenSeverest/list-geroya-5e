import hashlib
import json
import re
import zlib

from fastapi import HTTPException

COMPRESS_AFTER_BYTES = 2 * 1024
DATA_URL = re.compile(r"^data:[^;,]+;base64,", re.IGNORECASE)


def json_bytes(value) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def reject_embedded_binary(value) -> None:
    if isinstance(value, str) and DATA_URL.match(value.strip()):
        raise HTTPException(413, "Встроенные base64-файлы запрещены")
    if isinstance(value, dict):
        for nested in value.values():
            reject_embedded_binary(nested)
    elif isinstance(value, list):
        for nested in value:
            reject_embedded_binary(nested)


def encode_payload(raw: bytes) -> tuple[str, bytes]:
    if len(raw) <= COMPRESS_AFTER_BYTES:
        return "json", raw
    return "zlib-json", zlib.compress(raw, level=6)


def decode_payload(codec: str | None, payload: bytes | None):
    if payload is None:
        return None
    if codec == "zlib-json":
        payload = zlib.decompress(payload)
    elif codec != "json":
        raise ValueError("unsupported payload codec")
    return json.loads(payload.decode("utf-8"))


def payload_hash(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()
