#!/usr/bin/env python3
import json
import re
from pathlib import Path


DIST = Path(__file__).resolve().parents[1] / "dist"
PRERENDER_PLACEHOLDER = "0" * 64
DRAFT_PLACEHOLDER = "HEROLIST_DRAFT_SECRET_REPLACED_AT_RUNTIME"


for path in DIST.glob("server/**/vinext-server.json"):
    value = json.loads(path.read_text(encoding="utf-8"))
    value["prerenderSecret"] = PRERENDER_PLACEHOLDER
    path.write_text(json.dumps(value, separators=(",", ":")), encoding="utf-8")

server_entry = DIST / "server" / "index.js"
source = server_entry.read_text(encoding="utf-8")
source, replacements = re.subn(
    r'(function getDraftSecret\(\) \{\s*return ")[^"]+(";\s*\})',
    rf'\g<1>{DRAFT_PLACEHOLDER}\g<2>',
    source,
    count=1,
)
if replacements != 1:
    raise SystemExit("Could not sanitize Vinext draft-mode secret")
server_entry.write_text(source, encoding="utf-8")
