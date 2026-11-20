#!/usr/bin/env bash
set -euo pipefail
# Accepted generated raster artwork is versioned with the site.
for n in 1 2 3; do
  test -s "public/classic-sheet/page-$n.jpg" || { echo "Missing classic sheet page $n"; exit 1; }
done
