#!/usr/bin/env python3
"""Download public image URLs from one or more JSON manifests."""
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from PIL import Image, UnidentifiedImageError

ROOT = Path(__file__).resolve().parents[1]
MAX_SIZE = 18 * 1024 * 1024
EXTS = {".png": "PNG", ".jpg": "JPEG", ".jpeg": "JPEG", ".webp": "WEBP"}
HOSTS = {"raw.githubusercontent.com", "user-images.githubusercontent.com",
         "private-user-images.githubusercontent.com", "i.imgur.com"}

def permitted(url):
    parsed = urllib.parse.urlsplit(url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or parsed.username or parsed.password:
        return False
    return (host in HOSTS or (host == "github.com" and (
        parsed.path.startswith("/user-attachments/assets/") or
        "/releases/download/" in parsed.path)))

def download(url):
    if not permitted(url):
        raise ValueError("URL is not from an approved image host: " + url)
    req = urllib.request.Request(url, headers={"User-Agent": "HeroListAssetImport/1.0"})
    for retry in range(3):
        try:
            with urllib.request.urlopen(req, timeout=50) as stream:
                chunks, size = [], 0
                while True:
                    chunk = stream.read(1024 * 1024)
                    if not chunk:
                        return b"".join(chunks)
                    size += len(chunk)
                    if size > MAX_SIZE:
                        raise ValueError("Image is larger than 18 MiB")
                    chunks.append(chunk)
        except (urllib.error.URLError, TimeoutError):
            if retry == 2:
                raise
            time.sleep(2 ** retry)

def run_job(path):
    manifest = json.loads(path.read_text(encoding="utf-8"))
    if manifest.get("version") != 1 or not isinstance(manifest.get("assets"), list):
        raise ValueError("Invalid manifest in " + str(path))
    seen = set()
    for asset in manifest["assets"]:
        url, filename = asset["url"], asset["path"]
        rel = PurePosixPath(filename)
        if (not rel.parts or rel.is_absolute() or rel.parts[0] != "public"
                or ".." in rel.parts or "\\" in filename or rel.suffix.lower() not in EXTS):
            raise ValueError("Unsafe destination " + filename)
        if filename in seen:
            raise ValueError("Duplicate image " + filename)
        seen.add(filename)
        dest = ROOT.joinpath(*rel.parts)
        expected = asset.get("sha256")
        if expected is not None and (not isinstance(expected, str) or
           len(expected) != 64 or any(c not in "0123456789abcdef" for c in expected)):
            raise ValueError("Invalid sha256 for " + filename)
        if expected and dest.exists() and hashlib.sha256(dest.read_bytes()).hexdigest() == expected:
            print("SKIP verified", filename)
            continue
        data = download(url)
        sha = hashlib.sha256(data).hexdigest()
        if expected and sha != expected:
            raise ValueError("Image checksum mismatch: " + filename)
        try:
            with Image.open(io.BytesIO(data)) as image:
                image.verify()
            with Image.open(io.BytesIO(data)) as image:
                if image.format != EXTS[rel.suffix.lower()] or max(image.size) > 10000:
                    raise ValueError("Format or dimensions do not match " + filename)
        except (UnidentifiedImageError, Image.DecompressionBombError) as exc:
            raise ValueError("Invalid image " + filename) from exc
        if dest.exists() and dest.read_bytes() == data:
            print("SKIP unchanged", filename)
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        temporary = dest.with_name(dest.name + ".part")
        temporary.write_bytes(data)
        os.replace(temporary, dest)
        print("IMPORTED", filename, len(data), sha)

def main():
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python scripts/import_assets_manifest.py asset-import/jobs/job.json")
    for name in sys.argv[1:]:
        run_job(Path(name))

if __name__ == "__main__":
    main()
