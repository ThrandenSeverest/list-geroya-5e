#!/usr/bin/env python3
"""Batch-upload local PNG/JPEG/WebP to a GitHub branch; one atomic commit."""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import subprocess
import sys
import time
import urllib.error
import urllib.request

REPO = "ThrandenSeverest/list-geroya-5e"
EXTS = {".png", ".jpg", ".jpeg", ".webp"}
MAX_SIZE = 18 * 1024 * 1024

def authenticate():
    for variable in ("GH_TOKEN", "GITHUB_TOKEN"):
        if os.environ.get(variable):
            return os.environ[variable].strip()
    try:
        result = subprocess.run(["gh", "auth", "token"], check=True,
                                capture_output=True, text=True, timeout=12)
        return result.stdout.strip()
    except (OSError, subprocess.SubprocessError):
        raise SystemExit("Please run gh auth login once, or provide GH_TOKEN (Contents: write).")

def api(token, method, path, body=None):
    request = urllib.request.Request(
        "https://api.github.com/repos/" + REPO + "/" + path,
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={"Authorization": "Bearer " + token,
                 "Accept": "application/vnd.github+json",
                 "X-GitHub-Api-Version": "2022-11-28",
                 "Content-Type": "application/json",
                 "User-Agent": "HeroList-asset-importer"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=70) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            message = error.read(500).decode(errors="replace")
            if error.code not in (429, 500, 502, 503, 504) or attempt == 3:
                raise RuntimeError(f"{method} {path} failed: HTTP {error.code}: {message}") from error
        except (TimeoutError, urllib.error.URLError):
            if attempt == 3:
                raise
        time.sleep(2 ** attempt)

def hash_blob(data):
    return hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest()

def collect(source, destination):
    prefix = PurePosixPath(destination.replace("\\", "/"))
    if not prefix.parts or prefix.parts[0] != "public" or ".." in prefix.parts:
        raise ValueError("Destination must be inside public/")
    if not source.exists():
        raise ValueError(f"Missing source: {source}")
    paths = sorted(p for p in (source.rglob("*") if source.is_dir() else [source])
                   if p.is_file() and p.suffix.lower() in EXTS)
    if not paths:
        raise ValueError("No PNG, JPG or WEBP assets found")
    files = []
    for path in paths:
        rel = path.relative_to(source) if source.is_dir() else Path(path.name)
        data = path.read_bytes()
        if len(data) > MAX_SIZE:
            raise ValueError(f"Too large (>18 MiB): {path}")
        files.append((str(prefix.joinpath(*rel.parts)), data, hash_blob(data)))
    return files

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--branch", required=True)
    parser.add_argument("--dest", required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    files = collect(args.source, args.dest)
    print(f"Preparing {len(files)} files ({sum(len(b) for _,b,_ in files):,} bytes)")
    if args.dry_run:
        for path, _, _ in files:
            print(path)
        return
    token = authenticate()
    blobs = {}
    for attempt in range(3):
        head = api(token, "GET", "git/ref/heads/" + args.branch)["object"]["sha"]
        base_tree = api(token, "GET", "git/commits/" + head)["tree"]["sha"]
        tree = api(token, "GET", "git/trees/" + base_tree + "?recursive=1")
        if tree.get("truncated"):
            raise RuntimeError("GitHub returned a truncated tree, aborting")
        existing = {row["path"]: row["sha"] for row in tree["tree"] if row.get("type") == "blob"}
        changed = [(p,b,s) for p,b,s in files if existing.get(p) != s]
        if not changed:
            print("Done: all files already match their GitHub hashes")
            return
        entries = []
        for path, data, sha in changed:
            if sha not in blobs:
                result = api(token, "POST", "git/blobs",
                             {"content": base64.b64encode(data).decode("ascii"),
                              "encoding": "base64"})
                if result["sha"] != sha:
                    raise RuntimeError("Binary integrity check failed: " + path)
                blobs[sha] = sha
            entries.append({"path": path, "mode": "100644", "type": "blob", "sha": sha})
            print("Staged", path)
        newtree = api(token, "POST", "git/trees", {"base_tree": base_tree, "tree": entries})["sha"]
        commit = api(token, "POST", "git/commits", {
            "message": f"assets: upload {len(changed)} images", "tree": newtree, "parents": [head]})["sha"]
        try:
            api(token, "PATCH", "git/refs/heads/" + args.branch,
                {"sha": commit, "force": False})
        except RuntimeError as error:
            if attempt < 2 and ("HTTP 422" in str(error) or "HTTP 409" in str(error)):
                print("Concurrent update detected; retrying on current branch head")
                continue
            raise
        verified = api(token, "GET", "git/trees/" + newtree + "?recursive=1")
        found = {row["path"]: row["sha"] for row in verified["tree"] if row.get("type") == "blob"}
        if any(found.get(p) != s for p, _, s in files):
            raise RuntimeError("Post-upload verification failed: " + commit)
        print("VERIFIED https://github.com/" + REPO + "/commit/" + commit)
        return
    raise RuntimeError("Branch repeatedly changed during upload")

if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, RuntimeError) as error:
        print("UPLOAD FAILED:", error, file=sys.stderr)
        sys.exit(1)
