#!/bin/bash
# Full render + encode for book_open. Usage: render_book_open.sh <astra_script.py> [samples]
set -euo pipefail
BL="/Users/moorthy/Downloads/Projects/Naive hackathon/nightlight/assets/blender"
SCRIPT="$1"; SAMPLES="${2:-24}"
OUT="$BL/renders/book_open_full"
rm -rf "$OUT"; mkdir -p "$OUT"
T0=$(date +%s)
env -u OPENAI_API_KEY OUTPUT_DIR="$OUT" RES_X=1600 RES_Y=900 SAMPLES="$SAMPLES" \
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P "$SCRIPT" --python-exit-code 1 \
  > "$OUT/blender.log" 2>&1
T1=$(date +%s)
echo "render_seconds=$((T1-T0))"
ffmpeg -y -loglevel error -framerate 30 -start_number 1 -i "$OUT/frame_%04d.png" \
  -c:v libx264 -pix_fmt yuv420p -crf 20 -preset slow -movflags +faststart "$BL/book_open.mp4"
ls -l "$BL/book_open.mp4"
ffprobe -v error -show_entries format=duration -of csv=p=0 "$BL/book_open.mp4"
