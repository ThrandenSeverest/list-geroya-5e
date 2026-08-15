# FastAPI + SQLite backend

## Architecture
The React/Vinext frontend stays unchanged. Nginx sends `/api/` to FastAPI and all other paths to the frontend. `character_vaults.vault_json` is stored and returned as opaque JSON.

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
