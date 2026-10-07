#!/usr/bin/env python3
"""Fail CI if compiled dist has runtime-generated Vinext secrets committed.

The frontend startup intentionally replaces placeholders with fresh secrets.
Never commit files after startup without sanitizing them again.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "dist"
EXPECTED_DRAFT = "HEROLIST_DRAFT_SECRET_REPLACED_AT_RUNTIME"
EXPECTED_PRERENDER = "0" * 64

server_index = ROOT / "server/index.js"
assert server_index.is_file(), "Missing dist/server/index.js"
content = server_index.read_text(encoding="utf-8")
found = re.findall(r'function getDraftSecret\(\)\s*\{\s*return "([^"]+)";\s*\}', content)
assert found == [EXPECTED_DRAFT], (
    "Production dist has an unsanitized runtime draft secret or changed Vinext output"
)

for relative in ("server/vinext-server.json", "server/ssr/vinext-server.json"):
    path = ROOT / relative
    config = json.loads(path.read_text(encoding="utf-8"))
    assert config.get("prerenderSecret") == EXPECTED_PRERENDER, (
        f"{relative} includes an unsanitized runtime prerender secret"
    )
print("Precompiled dist contains runtime placeholders, not transient secrets.")
