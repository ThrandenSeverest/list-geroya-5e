#!/usr/bin/env bash
set -euo pipefail
# Public blank D&D 5e sheet artwork; render to static images for pixel-aligned overlays.
# Rendered only during build; the published app does not fetch cross-origin assets.
mkdir -p public/classic-sheet
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
curl --fail --location --retry 3 --connect-timeout 15 --max-time 120   "https://dnd.su/storage/files/DnD5e_character_sheet_RUS.pdf" -o "$tmp/blank.pdf"
if ! command -v pdftoppm >/dev/null; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq poppler-utils
fi
pdfinfo "$tmp/blank.pdf" | grep -q "Pages:.*3" || { echo "Unexpected reference PDF"; exit 1; }
pdftoppm -f 1 -l 3 -scale-to-x 760 -scale-to-y -1 -jpeg -jpegopt quality=72,optimize=y "$tmp/blank.pdf" "$tmp/classic"
for n in 1 2 3; do
  test -s "$tmp/classic-$n.jpg"
  cp "$tmp/classic-$n.jpg" "public/classic-sheet/page-$n.jpg"
done
