#!/usr/bin/env bash
set -Eeuo pipefail

CONFIG_FILE="${HEROLIST_UPDATE_CONFIG:-/etc/herolist-update.conf}"
if [[ -f "$CONFIG_FILE" ]]; then
  # The file is root-owned deployment configuration, not user input.
  # shellcheck source=/dev/null
  source "$CONFIG_FILE"
fi

APP_DIR="${APP_DIR:-/srv/herolist}"
API_ENV_FILE="${API_ENV_FILE:-$APP_DIR/backend/.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/herolist}"
BACKEND_VENV="${BACKEND_VENV:-$APP_DIR/backend/.venv}"
SERVICES="${SERVICES:-list-geroya-api list-geroya-web}"
API_HEALTH_URL="${API_HEALTH_URL:-http://127.0.0.1:8000/healthz}"
FRONTEND_HEALTH_URL="${FRONTEND_HEALTH_URL:-http://127.0.0.1:3000/}"
LEAN_HOSTING="${LEAN_HOSTING:-1}"
ARCHIVE_URL="https://github.com/ThrandenSeverest/list-geroya-5e/archive/refs/heads/main.tar.gz"

case "$APP_DIR" in
  ""|/|/srv|/var|/opt|/usr|/root)
    echo "Unsafe APP_DIR: $APP_DIR" >&2
    exit 2
    ;;
esac
[[ "$APP_DIR" = /* ]] || { echo "APP_DIR must be absolute" >&2; exit 2; }
[[ -d "$APP_DIR" ]] || { echo "Application directory does not exist: $APP_DIR" >&2; exit 2; }

for command in curl tar rsync npm node python3 systemctl; do
  command -v "$command" >/dev/null || { echo "Missing command: $command" >&2; exit 2; }
done

read -r -a SERVICE_LIST <<< "$SERVICES"
(( ${#SERVICE_LIST[@]} > 0 )) || { echo "SERVICES is empty" >&2; exit 2; }
for service in "${SERVICE_LIST[@]}"; do
  systemctl cat "$service" >/dev/null 2>&1 || {
    echo "systemd unit not found: $service" >&2
    echo "Edit $CONFIG_FILE before the first update." >&2
    exit 2
  }
done

TMP_DIR="$(mktemp -d /tmp/herolist-update-XXXXXXXX)"
SOURCE_ROOT="$TMP_DIR/source"
RUNTIME_ROOT="$TMP_DIR/runtime"
ROLLBACK_ROOT="$TMP_DIR/rollback"
DEPLOY_STARTED=0

start_services() {
  for service in "${SERVICE_LIST[@]}"; do
    systemctl start "$service" || true
  done
}

rollback() {
  local exit_code=$?
  trap - ERR INT TERM
  if [[ "$DEPLOY_STARTED" == 1 ]]; then
    echo "Update failed; restoring the previous code..." >&2
    if [[ -d "$ROLLBACK_ROOT/dist" ]]; then
      mkdir -p "$APP_DIR/dist"
      rsync -a --delete "$ROLLBACK_ROOT/dist/" "$APP_DIR/dist/"
    fi
    for path in app alembic scripts; do
      if [[ -d "$ROLLBACK_ROOT/backend/$path" ]]; then
        mkdir -p "$APP_DIR/backend/$path"
        rsync -a --delete "$ROLLBACK_ROOT/backend/$path/" "$APP_DIR/backend/$path/"
      fi
    done
    [[ ! -f "$ROLLBACK_ROOT/backend/requirements.txt" ]] || cp "$ROLLBACK_ROOT/backend/requirements.txt" "$APP_DIR/backend/requirements.txt"
    [[ ! -f "$ROLLBACK_ROOT/backend/alembic.ini" ]] || cp "$ROLLBACK_ROOT/backend/alembic.ini" "$APP_DIR/backend/alembic.ini"
    start_services
  fi
  rm -rf -- "$TMP_DIR"
  exit "$exit_code"
}
trap rollback ERR INT TERM
trap 'rm -rf -- "$TMP_DIR"' EXIT

echo "1/8 Downloading main into a temporary directory..."
mkdir -p "$SOURCE_ROOT"
curl --fail --location --silent --show-error "$ARCHIVE_URL" -o "$TMP_DIR/main.tar.gz"
tar -xzf "$TMP_DIR/main.tar.gz" -C "$SOURCE_ROOT" --strip-components=1
[[ -f "$SOURCE_ROOT/dist/server/index.js" && -f "$SOURCE_ROOT/dist/BUILD_INFO.json" && -f "$SOURCE_ROOT/backend/alembic.ini" ]] || {
  echo "Downloaded archive is incomplete" >&2
  exit 1
}

echo "2/8 Verifying the precompiled frontend..."
python3 - "$SOURCE_ROOT/dist/BUILD_INFO.json" <<'PY'
import json, sys
with open(sys.argv[1], encoding="utf-8") as source:
    value = json.load(source)
if value.get("project") != "list-geroya-5e" or not value.get("builtAt"):
    raise SystemExit("Invalid dist/BUILD_INFO.json")
print(f"Precompiled build: {value.get('version')} from {value['builtAt']}")
PY

# The committed build contains a non-sensitive build-time prerender token.
# Replace it on every production host so the public repository value is never used.
python3 - "$SOURCE_ROOT/dist" <<'PY'
import json, secrets, sys
from pathlib import Path
for path in Path(sys.argv[1]).glob("server/**/vinext-server.json"):
    value = json.loads(path.read_text(encoding="utf-8"))
    value["prerenderSecret"] = secrets.token_hex(32)
    path.write_text(json.dumps(value, separators=(",", ":")), encoding="utf-8")
PY

echo "3/8 Preparing the minimal frontend runtime..."
mkdir -p "$RUNTIME_ROOT"
cp "$SOURCE_ROOT/package.json" "$SOURCE_ROOT/package-lock.json" "$RUNTIME_ROOT/"
npm ci --prefix "$RUNTIME_ROOT" --omit=dev --ignore-scripts --legacy-peer-deps

echo "4/8 Reading the real SQLite path..."
DATABASE_URL_VALUE="$(python3 - "$API_ENV_FILE" <<'PY'
import os, sys
path = sys.argv[1]
value = os.environ.get("DATABASE_URL", "")
if not value and os.path.isfile(path):
    for raw in open(path, encoding="utf-8"):
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, candidate = line.split("=", 1)
        if key.strip() == "DATABASE_URL":
            value = candidate.strip().strip('"').strip("'")
            break
print(value or "sqlite:///./data/list-geroya.db")
PY
)"
DATABASE_FILE="$(python3 - "$DATABASE_URL_VALUE" "$APP_DIR/backend" <<'PY'
import os, sys
url, working = sys.argv[1:]
prefix = "sqlite:///"
if not url.startswith(prefix):
    raise SystemExit("Only SQLite backup is supported; set DATABASE_URL to sqlite:///...")
path = url[len(prefix):]
print(os.path.abspath(path if path.startswith("/") else os.path.join(working, path)))
PY
)"
[[ -f "$DATABASE_FILE" ]] || { echo "Database not found: $DATABASE_FILE" >&2; exit 1; }

echo "5/8 Stopping services and creating a verified database backup..."
DEPLOY_STARTED=1
for service in "${SERVICE_LIST[@]}"; do systemctl stop "$service"; done
mkdir -p "$BACKUP_DIR" "$ROLLBACK_ROOT/backend"
BACKUP_FILE="$BACKUP_DIR/list-geroya-before-update-$(date -u +%Y%m%d-%H%M%S).db"
python3 "$SOURCE_ROOT/backend/scripts/backup_db.py" "$DATABASE_FILE" "$BACKUP_FILE"
python3 - "$BACKUP_FILE" <<'PY'
import sqlite3, sys
with sqlite3.connect(sys.argv[1]) as db:
    result = db.execute("PRAGMA integrity_check").fetchone()[0]
if result != "ok":
    raise SystemExit(f"Backup integrity check failed: {result}")
PY

[[ ! -d "$APP_DIR/dist" ]] || rsync -a "$APP_DIR/dist/" "$ROLLBACK_ROOT/dist/"
for path in app alembic scripts; do
  [[ ! -d "$APP_DIR/backend/$path" ]] || rsync -a "$APP_DIR/backend/$path/" "$ROLLBACK_ROOT/backend/$path/"
done
[[ ! -f "$APP_DIR/backend/requirements.txt" ]] || cp "$APP_DIR/backend/requirements.txt" "$ROLLBACK_ROOT/backend/requirements.txt"
[[ ! -f "$APP_DIR/backend/alembic.ini" ]] || cp "$APP_DIR/backend/alembic.ini" "$ROLLBACK_ROOT/backend/alembic.ini"

echo "6/8 Replacing code while preserving .env, database and user files..."
mkdir -p "$APP_DIR/dist" "$APP_DIR/backend" "$APP_DIR/deployment" "$APP_DIR/node_modules"
rsync -a --delete "$SOURCE_ROOT/dist/" "$APP_DIR/dist/"
for path in app alembic scripts; do
  mkdir -p "$APP_DIR/backend/$path"
  rsync -a --delete "$SOURCE_ROOT/backend/$path/" "$APP_DIR/backend/$path/"
done
cp "$SOURCE_ROOT/backend/requirements.txt" "$SOURCE_ROOT/backend/alembic.ini" "$APP_DIR/backend/"
rsync -a --delete "$SOURCE_ROOT/deployment/" "$APP_DIR/deployment/"
rsync -a --delete "$RUNTIME_ROOT/node_modules/" "$APP_DIR/node_modules/"
cp "$SOURCE_ROOT/package.json" "$SOURCE_ROOT/package-lock.json" "$APP_DIR/"

if [[ "$LEAN_HOSTING" == 1 ]]; then
  for path in app public scripts tests .next .vinext; do
    [[ ! -e "$APP_DIR/$path" ]] || rm -rf -- "$APP_DIR/$path"
  done
fi

echo "7/8 Updating Python dependencies and applying migrations..."
if [[ ! -x "$BACKEND_VENV/bin/python" ]]; then
  python3 -m venv "$BACKEND_VENV"
fi
"$BACKEND_VENV/bin/python" -m pip install --disable-pip-version-check -r "$APP_DIR/backend/requirements.txt"
(
  cd "$APP_DIR/backend"
  DATABASE_URL="$DATABASE_URL_VALUE" "$BACKEND_VENV/bin/python" -m alembic upgrade head
)

echo "8/8 Starting services and checking the site..."
start_services
for attempt in {1..20}; do
  if curl --fail --silent "$API_HEALTH_URL" >/dev/null && curl --fail --silent "$FRONTEND_HEALTH_URL" >/dev/null; then
    DEPLOY_STARTED=0
    trap - ERR INT TERM
    echo "HeroList updated successfully."
    echo "Database backup: $BACKUP_FILE"
    du -sh "$APP_DIR/dist" "$APP_DIR/node_modules" 2>/dev/null || true
    exit 0
  fi
  sleep 1
done

echo "Health check failed after restart" >&2
false
