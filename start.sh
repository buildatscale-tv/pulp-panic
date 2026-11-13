#!/usr/bin/env bash
# Starts the game server and a Cloudflare quick tunnel, then prints the public link.
# Usage: ./start.sh          (Ctrl+C stops both)
set -euo pipefail
cd "$(dirname "$0")"
PORT="${PORT:-5178}"

if ! curl -s -o /dev/null "http://localhost:$PORT/"; then
  PORT="$PORT" node server.mjs &
  SERVER_PID=$!
  trap 'kill $SERVER_PID 2>/dev/null' EXIT
  sleep 0.5
fi

# An empty config file keeps quick tunnels independent of ~/.cloudflared/config.yml.
EMPTY_CFG="$(mktemp -t pulp-cf)"
LOG="$(mktemp -t pulp-cf-log)"
cloudflared tunnel --config "$EMPTY_CFG" --no-autoupdate --url "http://localhost:$PORT" >"$LOG" 2>&1 &
CF_PID=$!
trap 'kill $CF_PID ${SERVER_PID:-} 2>/dev/null' EXIT

for _ in $(seq 1 40); do
  URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" | head -1 || true)
  [ -n "$URL" ] && break
  sleep 0.5
done
echo "Local:  http://localhost:$PORT"
echo "Public: ${URL:-(tunnel not ready, see $LOG)}"
wait $CF_PID
