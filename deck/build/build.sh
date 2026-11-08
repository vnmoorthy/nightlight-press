#!/usr/bin/env bash
# Build deck/Nightlight.pptx: make_deck.js -> applyTheme -> motion.py -> validate.py
# Re-run any time; it re-reads assets/ so new screenshots and renders are picked up.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/../Nightlight.pptx"

# pptx skill scripts (apply_theme.js, office/validate.py); override with PPTX_SKILL=/path/to/skills/pptx
if [ -z "${PPTX_SKILL:-}" ]; then
  APPLY="$(find "$HOME/Library/Application Support/Claude" -name apply_theme.js -path '*skills/pptx/scripts/*' 2>/dev/null | head -1 || true)"
  [ -n "$APPLY" ] || { echo "cannot find the pptx skill (apply_theme.js); set PPTX_SKILL" >&2; exit 1; }
  PPTX_SKILL="$(dirname "$(dirname "$APPLY")")"
fi

WORK="$(mktemp -d "${TMPDIR:-/tmp}/nl-build-XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

echo "1/4 generate"
NODE_PATH="$HERE/node_modules" node "$HERE/make_deck.js" "$WORK/raw.pptx" "$WORK/theme.json"
echo "2/4 apply theme"
NODE_PATH="$HERE/node_modules" node "$PPTX_SKILL/scripts/apply_theme.js" "$WORK/raw.pptx" "$WORK/theme.json"
echo "3/4 motion"
python3 "$HERE/motion.py" "$WORK/raw.pptx" "$WORK/motion.pptx"
echo "4/4 validate"
# validate.py needs Python 3.10+ with defusedxml + lxml
if python3 -c 'import sys, defusedxml, lxml; sys.exit(sys.version_info < (3, 10))' 2>/dev/null; then
  python3 "$PPTX_SKILL/scripts/office/validate.py" "$WORK/motion.pptx"
elif command -v uv >/dev/null; then
  uv run -q --no-project --with defusedxml --with lxml --python 3.11 python "$PPTX_SKILL/scripts/office/validate.py" "$WORK/motion.pptx"
else
  echo "WARNING: no Python 3.10+ with defusedxml/lxml; skipped validate.py" >&2
fi
mv -f "$WORK/motion.pptx" "$OUT"
echo "done: $OUT ($(du -h "$OUT" | cut -f1))"
