#!/usr/bin/env python3
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

try:
    source_commit = subprocess.check_output(
        ["git", "rev-parse", "HEAD"], text=True, stderr=subprocess.DEVNULL, timeout=5
    ).strip()
except (OSError, subprocess.SubprocessError):
    source_commit = None

package = json.loads(Path("package.json").read_text(encoding="utf-8"))
Path("dist/BUILD_INFO.json").write_text(
    json.dumps(
        {
            "project": package["name"],
            "version": package["version"],
            "sourceCommit": source_commit,
            "builtAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        },
        ensure_ascii=False,
        indent=2,
    ) + "\n",
    encoding="utf-8",
)
