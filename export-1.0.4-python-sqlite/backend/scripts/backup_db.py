#!/usr/bin/env python3
import argparse, sqlite3
from pathlib import Path
p=argparse.ArgumentParser(); p.add_argument("source"); p.add_argument("destination"); args=p.parse_args()
src=sqlite3.connect(args.source); Path(args.destination).parent.mkdir(parents=True, exist_ok=True); dst=sqlite3.connect(args.destination)
with dst: src.backup(dst)
dst.close(); src.close(); print(args.destination)
