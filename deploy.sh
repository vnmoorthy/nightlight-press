#!/usr/bin/env bash
# Build the app and reconcile everything on Naïve: identity, vault, agents, schedules, the hosted app.
set -euo pipefail
cd "$(dirname "$0")"
set -a
[ -f ../.env ] && source ../.env
[ -f app/.env.local ] && source app/.env.local
[ -f .env ] && source .env
set +a
if [ -n "${STRIPE_SECRET_KEY:-}" ]; then export NL_STRIPE_KEY="$STRIPE_SECRET_KEY"; fi
export NL_STRIPE_KEY="${NL_STRIPE_KEY:-none}" MOBILERUN_DEVICE_ID="${MOBILERUN_DEVICE_ID:-none}" NL_WITH_APPS="${NL_WITH_APPS:-1}"
export NL_COMPANY_KEY="${NAIVE_API_KEY}" NL_AM_WHSEC="${AGENTMAIL_WEBHOOK_SECRET:-none}" NL_NAIVE_WHSEC="${NAIVE_WEBHOOK_SECRET:-none}"
unset DATABASE_URL
[ "$NL_WITH_APPS" = "1" ] && [ "${SKIP_BUILD:-0}" != "1" ] && (cd app && node gen-prompts.mjs && node build.mjs)
for i in $(seq 1 12); do
  out=$(./node_modules/.bin/naive up --dir . "$@" 2>&1) || true
  if echo "$out" | grep -qiE "429|capacity|rate_limit"; then echo "naive is busy, retrying ($i)"; sleep 20; continue; fi
  echo "$out"; break
done
