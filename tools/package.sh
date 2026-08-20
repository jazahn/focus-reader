#!/usr/bin/env bash
#
# Build the ZIP to upload to the Chrome Web Store.
#
# Files are listed explicitly rather than excluded by pattern, so a new dev-only
# file never ships by accident. Reviewers do read the bundle, and shipping the
# test bench or the diagnostic script invites questions you do not want.
#
#   ./tools/package.sh

set -euo pipefail

cd "$(dirname "$0")/.."

SHIP=(
  manifest.json
  content.js
  content.css
  background.js
  popup.html
  popup.css
  popup.js
  icons/icon16.png
  icons/icon32.png
  icons/icon48.png
  icons/icon128.png
  icons/icon16-off.png
  icons/icon32-off.png
  icons/icon48-off.png
  icons/icon128-off.png
)

VERSION=$(python3 -c 'import json; print(json.load(open("manifest.json"))["version"])')
OUT="dist/focus-reader-${VERSION}.zip"

for f in "${SHIP[@]}"; do
  [ -f "$f" ] || { echo "missing required file: $f" >&2; exit 1; }
done

# Fail early on anything the store rejects outright.
python3 - <<'PY'
import json, sys

m = json.load(open("manifest.json"))
problems = []

if m.get("manifest_version") != 3:
    problems.append("manifest_version must be 3")
if "128" not in m.get("icons", {}):
    problems.append("a 128x128 icon is required for the store listing")
if len(m.get("description", "")) > 132:
    problems.append("description exceeds the 132-character store limit")
if not m.get("description"):
    problems.append("description is required")

if problems:
    print("manifest problems:", file=sys.stderr)
    for p in problems:
        print(f"  - {p}", file=sys.stderr)
    sys.exit(1)
PY

for f in content.js background.js popup.js; do
  node --check "$f" >/dev/null 2>&1 || { echo "syntax error in $f" >&2; exit 1; }
done

mkdir -p dist
rm -f "$OUT"
zip -q -r -X "$OUT" "${SHIP[@]}"

echo "built $OUT ($(du -h "$OUT" | cut -f1))"
echo
echo "Contents:"
# -Z1 prints bare names, one per line: portable across BSD and GNU userlands.
unzip -Z1 "$OUT" | sed 's/^/  /'
echo
echo "Remember: every upload needs a higher \"version\" in manifest.json than the"
echo "last one you published. Current version is ${VERSION}."
