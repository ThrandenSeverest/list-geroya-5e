#!/usr/bin/env python3
import json
from datetime import datetime, timezone
from pathlib import Path

package = json.loads(Path("package.json").read_text(encoding="utf-8"))
Path("dist/BUILD_INFO.json").write_text(
    json.dumps(
        {
            "project": package["name"],
            "version": package["version"],
            "builtAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        },
        ensure_ascii=False,
        indent=2,
    ) + "\n",
    encoding="utf-8",
)
