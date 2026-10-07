#!/usr/bin/env python3
"""Remove expected per-build randomness before comparing two Vinext builds."""

import json
import re
import sys
import hashlib
from collections import defaultdict
import difflib
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




# Build directories can be different (for example, GitHub Actions checks out the
# repository at another absolute path). Rolldown emits source paths in //#region
# comments; those harmless comments influence chunk hashes and all chunk imports.
# Compare contents instead of unreliable filename hashes, without overlooking a
# changed asset or changed runtime code.
_HASHED_CHUNK = re.compile(r"-[A-Za-z0-9_-]{8}(?=\.(?:js|css)(?![A-Za-z0-9]))")
_SOURCE_REGION = re.compile(r"(?m)^//#region[^\r\n]*$")


def comparable_content(path: Path) -> bytes:
    data = path.read_bytes()
    if path.suffix not in {".js", ".css", ".json", ".html"}:
        return data
    try:
        content = data.decode("utf-8")
    except UnicodeDecodeError:
        return data
    if path.suffix == ".js":
        content = _SOURCE_REGION.sub("//#region [source path]", content)
    # Module names are compared independently, including multiple assets with the
    # same prefix (for example the various page-<hash>.js chunks). References in
    # bundles and RSC manifests are canonicalized consistently.
    content = _HASHED_CHUNK.sub("-[BUILDHASH]", content)
    return content.encode("utf-8")


def comparable_files(root: Path) -> dict[str, list[tuple[str, bytes]]]:
    result: dict[str, list[tuple[str, bytes]]] = defaultdict(list)
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        name = _HASHED_CHUNK.sub("-[BUILDHASH]", path.relative_to(root).as_posix())
        result[name].append((path.relative_to(root).as_posix(), comparable_content(path)))
    return result


def inventory(root: Path) -> dict[str, list[str]]:
    result = {}
    for key, entries in comparable_files(root).items():
        result[key] = sorted(hashlib.sha256(content).hexdigest() for _, content in entries)
    return result


def diagnostic(left: Path, right: Path, key: str) -> None:
    left_entries = comparable_files(left).get(key, [])
    right_entries = comparable_files(right).get(key, [])
    if len(left_entries) != 1 or len(right_entries) != 1:
        return
    left_name, left_bytes = left_entries[0]
    right_name, right_bytes = right_entries[0]
    try:
        a = left_bytes.decode("utf-8")
        b = right_bytes.decode("utf-8")
    except UnicodeDecodeError:
        return
    matcher = difflib.SequenceMatcher(None, a, b, autojunk=False)
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            continue
        start_a, end_a = max(0, i1 - 220), min(len(a), i2 + 220)
        start_b, end_b = max(0, j1 - 220), min(len(b), j2 + 220)
        print(f"    first difference {left_name} vs {right_name}: {tag}", file=sys.stderr)
        print("    committed: " + repr(a[start_a:end_a]), file=sys.stderr)
        print("    rebuilt:   " + repr(b[start_b:end_b]), file=sys.stderr)
        break


def compare(left: Path, right: Path) -> bool:
    first, second = inventory(left), inventory(right)
    mismatched = [key for key in sorted(first.keys() | second.keys())
                  if first.get(key) != second.get(key)]
    if not mismatched:
        print("Committed dist and independently rebuilt dist have identical runtime "
              "content (ignoring build IDs, comments with build paths and "
              "content-hashed chunk filenames).")
        return True
    print(f"Runtime content differs in {len(mismatched)} file groups:", file=sys.stderr)
    for key in mismatched[:50]:
        print(f"  {key}: committed={first.get(key, [])} built={second.get(key, [])}",
              file=sys.stderr)
        diagnostic(left, right, key)
    return False

if len(sys.argv) != 3:
    raise SystemExit("Usage: normalize-dist-for-compare.py COMMITTED_DIST REBUILT_DIST")
left, right = (Path(arg) for arg in sys.argv[1:])
for root in (left, right):
    normalize(root)
if not compare(left, right):
    raise SystemExit(1)
