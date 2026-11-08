#!/usr/bin/env bash
# Run Nightlight locally on :3100 with the company's keys from ../../.env and this app's .env.local.
cd "$(dirname "$0")"
set -a; [ -f ../../.env ] && source ../../.env; [ -f ../.env ] && source ../.env; source .env.local; set +a
node gen-prompts.mjs >/dev/null && exec node --watch-path=./src src/server.js
