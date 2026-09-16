# FastAPI + SQLite backend

## Architecture
Nginx sends `/api/` to FastAPI and all other paths to the frontend. New vault writes use the versioned `compact_payload` column and zlib level 6 above 2 KiB; legacy `vault_json` rows remain readable and migrate on the next save. Homebrew is stored per entity in `homebrew_entities`; legacy `homebrew_libraries` rows remain readable until the next save. Neither store is exposed through the public catalogs.

Storage guards default to 100 characters, 256 KiB raw / 64 KiB compressed per character, 100 homebrew elements, 32 KiB per element and 2 MiB total homebrew. Embedded base64 data URLs are rejected. Limits can be overridden with the matching `CHARACTER_*` and `HOMEBREW_*` environment variables.

## Local setup
```bash
cd backend
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --host 127.0.0.1 --port 8000
pytest
```
Set `DATABASE_URL` to a persistent disk in production, e.g. `sqlite:////var/lib/list-geroya/list-geroya.db`.

Before every deployment, back up the database and run `alembic upgrade head`. Migration `0003_compact_storage` only adds columns and the normalized homebrew table; it does not rewrite or delete existing JSON.

## Mail.ru SMTP
Email delivery can use Mail.ru without Cloudflare or Resend. Create a Mail.ru external-application password with sending-only access, then set these secret environment variables in the host (never commit them):

```env
EMAIL_VERIFICATION_ENABLED=true
EMAIL_DELIVERY_ENABLED=true
SMTP_HOST=smtp.mail.ru
SMTP_PORT=465
SMTP_USERNAME=heroleaf@mail.ru
SMTP_PASSWORD=mailru-external-application-password
EMAIL_FROM=heroleaf@mail.ru
```

`REQUIRE_VERIFIED_EMAIL=false` is recommended during the first delivery test. The backend uses SMTP when its four SMTP values are present; otherwise it can use the existing Resend configuration.

## D1 migration and validation
`wrangler d1 export list-geroya-db --remote --output=d1-final.sql`

`DATABASE_URL=sqlite:////var/lib/list-geroya/list-geroya.db alembic upgrade head`

`python scripts/migrate_d1_to_sqlite.py d1-final.sql --database-url sqlite:////var/lib/list-geroya/list-geroya.db`

The importer never modifies D1, reports row counts/orphans/invalid vault JSON, and preserves IDs, password hashes/salts, token/session hashes and vault JSON.

## Backup
`python scripts/backup_db.py /var/lib/list-geroya/list-geroya.db /backups/list-geroya-$(date +%F).db`

It uses SQLite's backup API and is WAL-safe.

## Production, cutover, rollback
Run with a service manager: `uvicorn app.main:app --host 127.0.0.1 --port 8000 --proxy-headers`.

```nginx
location /api/ { proxy_pass http://127.0.0.1:8000; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto $scheme; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; }
location / { proxy_pass http://127.0.0.1:3000; }
```

For cutover: maintenance/read-only → final D1 export → fresh SQLite import/validation → test login and vault → atomically switch `/api/`. Keep D1 intact. For rollback, stop FastAPI writes and atomically restore the old API route. Do not allow both backends to accept writes: that would split user vaults.
