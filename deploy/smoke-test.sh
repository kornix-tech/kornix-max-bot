#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
BASE_URL="${BASE_URL%/}"

echo "Checking ${BASE_URL}/health"
health_response="$(curl -fsS "${BASE_URL}/health")"
printf '%s\n' "${health_response}" | grep -q '"status":"ok"'

echo "Checking ${BASE_URL}/max/webhook with ignored update"
headers=(-H "Content-Type: application/json")
if [[ "${MAX_WEBHOOK_SECRET:-}" != "" ]]; then
  headers+=(-H "X-Max-Bot-Api-Secret: ${MAX_WEBHOOK_SECRET}")
fi

webhook_response="$(
  curl -fsS \
    -X POST \
    "${headers[@]}" \
    --data '{"update_type":"bot_started","user":{"user_id":"smoke-test"}}' \
    "${BASE_URL}/max/webhook"
)"
printf '%s\n' "${webhook_response}" | grep -q '"ok":true'

echo "Smoke checks passed."
