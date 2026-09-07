#!/usr/bin/env bash
# Starts CampusConnect for local development.
#
#   cd api && ./run-local.sh
#
# Holds no secrets. Anything you want to override, set in your shell first:
#
#   MAIL_HOST=smtp.resend.com MAIL_PORT=587 MAIL_USERNAME=resend \
#   MAIL_PASSWORD='re_your_key' MAIL_FROM='CampusConnect <no-reply@yourdomain.com>' \
#   ./run-local.sh
#
# With no MAIL_HOST the verification links are printed to this console instead
# of being emailed, which is what you want until a sending domain is set up.
set -euo pipefail

cd "$(dirname "$0")"

export JAVA_HOME="${JAVA_HOME:-/c/Users/josep/tools/jdk-21}"
export PATH="$JAVA_HOME/bin:/c/Users/josep/tools/maven/bin:$PATH"

# The demo providers are gone and this database holds real setup now. Seeding
# only fires on a database with no universities, but leaving it off means a
# rebuilt database never quietly refills with fake barbers.
export SEED_DEMO_DATA="${SEED_DEMO_DATA:-false}"

# Your machine's address on the Wi-Fi, so links in emails work from a phone as
# well as this laptop. Changes when you join a different network — find the
# current one with:  ipconfig | grep IPv4
LAN_IP="${LAN_IP:-100.70.52.154}"

# The pages and the API come from this one process, so this is the only
# address there is — and it is what verification links point at.
export APP_URL="${APP_URL:-http://${LAN_IP}:8080}"

echo "app      http://localhost:8080"
echo "links    ${APP_URL}"
echo "mail     ${MAIL_HOST:-console (nothing is actually sent)}"
echo

exec mvn spring-boot:run
