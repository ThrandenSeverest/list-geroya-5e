#!/usr/bin/env python3
"""Remove expected per-build randomness before comparing two Vinext builds."""

import json
import re
import sys
from pathlib import Path


def normalize(root: Path) -> None:
    info = root / "BUILD_INFO.json"
    if info.exists():
        info.unlink()

    build_ids: list[str] = []
    for path in root.glob("server/**/BUILD_ID"):
        build_ids.append(path.read_text(encoding="utf-8").strip())
        path.unlink()

    for path in root.glob("server/**/vinext-server.json"):
        value = json.loads(path.read_text(encoding="utf-8"))
        value["prerenderSecret"] = "normalized-for-compare"
        path.write_text(json.dumps(value, sort_keys=True), encoding="utf-8")

    for path in root.rglob("*"):
        if not path.is_file() or path.suffix not in {".js", ".json", ".html"}:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        normalized = text
        detected = re.search(r'get buildId\(\) \{\s*return "([^"]+)";', normalized)
        if detected:
            build_ids.append(detected.group(1))
        for build_id in set(build_ids):
            normalized = normalized.replace(build_id, "normalized-build-id")
        normalized = re.sub(
            r'(function getDraftSecret\(\) \{\s*return ")[^"]+(";\s*\})',
            r'\1normalized-draft-secret\2',
            normalized,
        )
        if normalized != text:
            path.write_text(normalized, encoding="utf-8")


if len(sys.argv) < 2:
    raise SystemExit("Usage: normalize-dist-for-compare.py DIST [DIST...]")
for argument in sys.argv[1:]:
    normalize(Path(argument))
