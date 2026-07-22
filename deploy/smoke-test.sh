#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
BASE_URL="${BASE_URL%/}"
smoke_tmp_dir="$(mktemp -d)"
trap 'rm -rf -- "${smoke_tmp_dir}"' EXIT

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

echo "Checking ${BASE_URL}/miniapp feature flag"
miniapp_status="$(curl -sS -o "${smoke_tmp_dir}/miniapp.html" -w '%{http_code}' "${BASE_URL}/miniapp")"
auth_status="$(curl -sS -o "${smoke_tmp_dir}/miniapp-auth.json" -w '%{http_code}' \
  -H "Content-Type: application/json" \
  --data '{"initData":"invalid"}' \
  "${BASE_URL}/miniapp/api/v1/auth/max")"
if [[ "${MAX_MINIAPP_ENABLED:-false}" == "true" ]]; then
  [[ "${miniapp_status}" == "200" ]]
  grep -q '<div id="root"></div>' "${smoke_tmp_dir}/miniapp.html"
  [[ "${auth_status}" == "401" ]]
else
  [[ "${miniapp_status}" == "404" ]]
  [[ "${auth_status}" == "404" ]]
fi
echo "Smoke checks passed."
