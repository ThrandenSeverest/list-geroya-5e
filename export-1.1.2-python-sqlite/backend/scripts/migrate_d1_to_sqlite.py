#!/usr/bin/env python3
"""Import a `wrangler d1 export ... --output=d1.sql` dump without touching D1."""
import argparse, json, sqlite3, sys
from pathlib import Path
from sqlalchemy import create_engine, text

TABLES = ("users", "auth_sessions", "auth_tokens", "auth_rate_limits", "character_vaults")
def main():
    p=argparse.ArgumentParser(); p.add_argument("dump"); p.add_argument("--database-url", required=True); args=p.parse_args()
    # Dumps can create child tables before parent tables. Disable checks only while
    # loading the read-only staging database; target SQLite keeps them enabled.
    source=sqlite3.connect(":memory:"); source.execute("PRAGMA foreign_keys=OFF")
    try: source.executescript(Path(args.dump).read_text(encoding="utf-8"))
    except sqlite3.Error as e: sys.exit(f"Could not load D1 SQL export: {e}")
    source.execute("PRAGMA foreign_keys=ON")
    existing={r[0] for r in source.execute("SELECT name FROM sqlite_master WHERE type='table'")}; missing=set(TABLES)-existing
    if missing: sys.exit(f"Export misses expected tables: {', '.join(sorted(missing))}")
    checks = {
        "orphan sessions": "SELECT COUNT(*) FROM auth_sessions s LEFT JOIN users u ON u.id=s.user_id WHERE u.id IS NULL",
        "orphan auth tokens": "SELECT COUNT(*) FROM auth_tokens t LEFT JOIN users u ON u.id=t.user_id WHERE u.id IS NULL",
        "orphan character_vaults": "SELECT COUNT(*) FROM character_vaults v LEFT JOIN users u ON u.id=v.user_id WHERE u.id IS NULL",
        "duplicate emails": "SELECT COUNT(*) FROM (SELECT email FROM users GROUP BY email HAVING COUNT(*)>1)",
        "duplicate session token hashes": "SELECT COUNT(*) FROM (SELECT token_hash FROM auth_sessions GROUP BY token_hash HAVING COUNT(*)>1)",
        "duplicate auth token hashes": "SELECT COUNT(*) FROM (SELECT token_hash FROM auth_tokens GROUP BY token_hash HAVING COUNT(*)>1)",
    }
    violations={name: source.execute(query).fetchone()[0] for name, query in checks.items()}
    if any(violations.values()):
        for name, value in violations.items(): print(f"ERROR: {name}: {value}")
        sys.exit("Export integrity errors; target SQLite was not changed.")
    target=create_engine(args.database_url)
    with target.begin() as out:
        report=[]
        for table in TABLES:
            cur=source.execute(f'SELECT * FROM "{table}"'); columns=[x[0] for x in cur.description]; rows=cur.fetchall()
            for row in rows: out.execute(text(f'INSERT INTO "{table}" ({",".join(columns)}) VALUES ({",".join(":"+c for c in columns)})'), dict(zip(columns,row)))
            report.append((table,len(rows),out.execute(text(f'SELECT COUNT(*) FROM "{table}"')).scalar_one()))
        problems=[]
        for user_id, raw in source.execute("SELECT user_id, vault_json FROM character_vaults"):
            try:
                value=json.loads(raw)
                if not isinstance(value,dict) or not {"version","capacity","activeId","slots"} <= value.keys(): problems.append(f"vault {user_id}: missing core fields")
            except json.JSONDecodeError as e: problems.append(f"vault {user_id}: invalid JSON ({e})")
    print("\n".join(f"{t}: D1/export: {a}; SQLite: {b}; {'OK' if a==b else 'MISMATCH'}" for t,a,b in report)); print("integrity checks: OK")
    for item in problems: print("WARNING:",item)
    if any(a!=b for _,a,b in report): sys.exit(2)
if __name__ == "__main__": main()
