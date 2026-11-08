#!/bin/bash
# Usage: run_office_test.sh <frames-or-all> <res_pct> <samples> <outdir> <log>
B=/Applications/Blender.app/Contents/MacOS/Blender
S="$(dirname "$0")/office_flythrough.py"
mkdir -p "$4"
if [ "$1" = "all" ]; then unset NL_FRAMES; else export NL_FRAMES="$1"; fi
export NL_RES_PCT="$2" NL_SAMPLES="$3" NL_OUT="$4"
start=$(date +%s)
"$B" -b --factory-startup -P "$S" --python-exit-code 1 > "$5" 2>&1
rc=$?
echo "exit=$rc seconds=$(( $(date +%s) - start ))"
exit $rc
