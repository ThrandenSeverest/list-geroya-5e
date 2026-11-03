#!/usr/bin/env python3
"""Ingest GitHub-hosted images from comments on HeroList issue #19."""
import hashlib
import io
import json
import os
from pathlib import Path
import re
import sys
import urllib.parse
import urllib.request
from PIL import Image, UnidentifiedImageError

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "public/experimental/inbox/issue-19"
PATTERN = re.compile(r"!\[([^\]]*)\]\((https://[^\s)]+)\)")
EXTS = {"PNG": ".png", "JPEG": ".jpg", "WEBP": ".webp"}
MAX_SIZE = 18 * 1024 * 1024

def allowed(url):
    p = urllib.parse.urlsplit(url)
    return (p.scheme == "https" and not p.username and not p.password and
            ((p.hostname == "github.com" and p.path.startswith("/user-attachments/assets/"))
             or p.hostname in {"user-images.githubusercontent.com", "private-user-images.githubusercontent.com"}))

def download(url):
    if not allowed(url):
        raise ValueError("Untrusted URL")
    req = urllib.request.Request(url, headers={"User-Agent": "HeroList-Image-Inbox"})
    with urllib.request.urlopen(req, timeout=50) as res:
        output = bytearray()
        while True:
            chunk = res.read(1024 * 1024)
            if not chunk:
                break
            output.extend(chunk)
            if len(output) > MAX_SIZE:
                raise ValueError("Image is too large")
    data = bytes(output)
    try:
        with Image.open(io.BytesIO(data)) as img:
            img.verify()
        with Image.open(io.BytesIO(data)) as img:
            ext = EXTS.get(img.format)
            if not ext or max(img.size) > 10000:
                raise ValueError("Unsupported image")
    except (UnidentifiedImageError, Image.DecompressionBombError) as exc:
        raise ValueError("Invalid image bytes") from exc
    return data, ext

def main():
    event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text(encoding="utf-8"))
    issue, comment = event["issue"], event["comment"]
    if issue["number"] != 19 or comment["user"]["login"] != "ThrandenSeverest":
        raise ValueError("Only repository owner comments on issue #19 are permitted")
    images = [(alt, url) for alt, url in PATTERN.findall(comment.get("body") or "") if allowed(url)]
    if len(images) > 30:
        raise ValueError("Maximum 30 images per comment")
    if not images:
        print("No uploaded image links detected")
        return
    DEST.mkdir(parents=True, exist_ok=True)
    index_path = DEST / "index.json"
    old = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else []
    entries = {x["sha256"]: x for x in old}
    for alt, url in images:
        data, ext = download(url)
        digest = hashlib.sha256(data).hexdigest()
        target = DEST / (digest[:20] + ext)
        rel = target.relative_to(ROOT).as_posix()
        if not target.exists() or hashlib.sha256(target.read_bytes()).hexdigest() != digest:
            target.write_bytes(data)
        entries[digest] = {"sha256": digest, "path": rel,
                           "comment_id": comment["id"], "alt": alt[:150],
                           "bytes": len(data)}
        print("Verified", rel, len(data), "bytes")
    index_path.write_text(json.dumps(sorted(entries.values(), key=lambda item: item["path"]),
                                    ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError) as exc:
        print("Image transfer failed:", exc, file=sys.stderr)
        sys.exit(1)
