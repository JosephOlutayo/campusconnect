#!/usr/bin/env bash
# Put CampusConnect on the public internet from this machine.
#
#   ./go-live.sh
#
# Opens two Cloudflare tunnels — one for the website, one for the API, which
# the browser needs separately for live messaging — then rebuilds and starts
# both with those public URLs baked in. Prints the address to share.
#
# This is your laptop serving the internet. It is genuinely public and works
# from any phone anywhere, but:
#   - it stops the moment this machine sleeps or the script is closed
#   - the URLs are random and change every run
#   - real traffic hits your machine
# For always-on hosting, see DEPLOY.md.
set -euo pipefail

cd "$(dirname "$0")"

export JAVA_HOME="${JAVA_HOME:-/c/Users/josep/tools/jdk-21}"
export PATH="$JAVA_HOME/bin:/c/Users/josep/tools/maven/bin:$PATH"

LOGS="${TMPDIR:-/tmp}/campusconnect-live"
mkdir -p "$LOGS"

cleanup() {
  echo
  echo "Shutting down…"
  # The Maven wrapper is not the JVM, so killing the wrapper leaves the API up.
  powershell.exe -NoProfile -Command "Get-Process java,node,cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force" >/dev/null 2>&1 || true
  echo "Stopped. Your machine is no longer reachable from the internet."
}
trap cleanup EXIT INT TERM

echo "Clearing anything already running…"
powershell.exe -NoProfile -Command "Get-Process java,node,cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force" >/dev/null 2>&1 || true
sleep 3

# --- tunnels ----------------------------------------------------------------
wait_for_url() {           # $1 = logfile, $2 = label
  local f="$1" label="$2" url="" i
  for i in $(seq 1 40); do
    url=$(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" "$f" 2>/dev/null | head -1 || true)
    [ -n "$url" ] && { echo "$url"; return 0; }
    sleep 2
  done
  echo "Could not get a $label tunnel URL. See $f" >&2
  return 1
}

echo "Opening the API tunnel…"
nohup npx --yes cloudflared@latest tunnel --url http://localhost:8080 > "$LOGS/tunnel-api.log" 2>&1 &
API_URL=$(wait_for_url "$LOGS/tunnel-api.log" "API")

echo "Opening the website tunnel…"
nohup npx --yes cloudflared@latest tunnel --url http://localhost:3100 > "$LOGS/tunnel-web.log" 2>&1 &
WEB_URL=$(wait_for_url "$LOGS/tunnel-web.log" "website")

echo
echo "  website : $WEB_URL"
echo "  api     : $API_URL"
echo

# --- API --------------------------------------------------------------------
# CORS_ORIGINS must match the website's public origin exactly or the browser
# refuses the WebSocket handshake. APP_URL is what verification links point at.
echo "Starting the API…"
(
  cd api
  CORS_ORIGINS="$WEB_URL,http://localhost:3100" \
  APP_URL="$WEB_URL" \
  SEED_DEMO_DATA=false \
  nohup mvn -o spring-boot:run > "$LOGS/api.log" 2>&1 &
)

for i in $(seq 1 90); do
  curl -s -o /dev/null -m 2 http://localhost:8080/actuator/health 2>/dev/null && break
  sleep 2
done
echo "API up."

# --- website ----------------------------------------------------------------
# NEXT_PUBLIC_WS_URL is inlined into the browser bundle at BUILD time, so the
# site has to be rebuilt whenever the tunnel URL changes. Turbopack caches the
# old value, hence the clean.
echo "Building the site with the public URLs (about a minute)…"
rm -rf .next
NEXT_PUBLIC_WS_URL="$API_URL/ws" API_BASE_URL="http://localhost:8080" npx next build > "$LOGS/build.log" 2>&1 || {
  echo "Build failed. See $LOGS/build.log" >&2; exit 1; }

echo "Starting the site…"
NEXT_PUBLIC_WS_URL="$API_URL/ws" API_BASE_URL="http://localhost:8080" \
  nohup npx next start -p 3100 > "$LOGS/web.log" 2>&1 &

for i in $(seq 1 60); do
  curl -s -o /dev/null -m 3 http://localhost:3100/ 2>/dev/null && break
  sleep 2
done

echo
echo "==================================================================="
echo "  LIVE:  $WEB_URL"
echo "==================================================================="
echo
echo "Open it on any phone, anywhere. Add to Home Screen from Safari for"
echo "the app icon."
echo
echo "Stays up while this window is open. Ctrl+C to stop."
echo

# Hold the script open so the trap runs on Ctrl+C.
while true; do sleep 3600; done
