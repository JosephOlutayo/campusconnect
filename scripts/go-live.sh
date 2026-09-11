#!/usr/bin/env bash
# Put CampusConnect on the public internet from this machine.
#
#   ./scripts/go-live.sh
#
# Opens one Cloudflare tunnel and starts the app behind it, then prints the
# address to share. One tunnel is enough now that the pages and the API come
# from the same process — the second tunnel, and the CORS and WebSocket URLs
# that had to be kept in step with it, are gone.
#
# This is your laptop serving the internet. It is genuinely public and works
# from any phone anywhere, but:
#   - it stops the moment this machine sleeps or the script is closed
#   - the URL is random and changes every run
#   - real traffic hits your machine
# For always-on hosting, see docs/DEPLOY.md.
set -euo pipefail

# This script lives in scripts/, so the repository root is one level up.
cd "$(dirname "$0")/.."

export JAVA_HOME="${JAVA_HOME:-/c/Users/josep/tools/jdk-21}"
export PATH="$JAVA_HOME/bin:/c/Users/josep/tools/maven/bin:$PATH"

LOGS="${TMPDIR:-/tmp}/campusconnect-live"
mkdir -p "$LOGS"

cleanup() {
  echo
  echo "Shutting down…"
  # The Maven wrapper is not the JVM, so killing the wrapper leaves the app up.
  powershell.exe -NoProfile -Command "Get-Process java,cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force" >/dev/null 2>&1 || true
  echo "Stopped. Your machine is no longer reachable from the internet."
}
trap cleanup EXIT INT TERM

echo "Clearing anything already running…"
powershell.exe -NoProfile -Command "Get-Process java,cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force" >/dev/null 2>&1 || true
sleep 3

# --- tunnel -----------------------------------------------------------------
echo "Opening the tunnel…"
nohup npx --yes cloudflared@latest tunnel --url http://localhost:8080 > "$LOGS/tunnel.log" 2>&1 &

PUBLIC_URL=""
for i in $(seq 1 40); do
  PUBLIC_URL=$(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" "$LOGS/tunnel.log" 2>/dev/null | head -1 || true)
  [ -n "$PUBLIC_URL" ] && break
  sleep 2
done
[ -n "$PUBLIC_URL" ] || { echo "Could not get a tunnel URL. See $LOGS/tunnel.log" >&2; exit 1; }

# --- the app ----------------------------------------------------------------
# APP_URL is what verification links point at, so it has to be the public
# address rather than localhost.
echo "Starting CampusConnect…"
(
  cd api
  APP_URL="$PUBLIC_URL" \
  SEED_DEMO_DATA=false \
  nohup mvn -o spring-boot:run > "$LOGS/app.log" 2>&1 &
)

for i in $(seq 1 90); do
  curl -s -o /dev/null -m 2 http://localhost:8080/actuator/health 2>/dev/null && break
  sleep 2
done

echo
echo "==================================================================="
echo "  LIVE:  $PUBLIC_URL"
echo "==================================================================="
echo
echo "Open it on any phone, anywhere. Add to Home Screen from Safari for"
echo "the app icon."
echo
echo "Stays up while this window is open. Ctrl+C to stop."
echo

# Hold the script open so the trap runs on Ctrl+C.
while true; do sleep 3600; done
