#!/bin/sh
# Standard Node.js only; no AI desktop application or subscription is required.
set -eu
cd "$(dirname "$0")/.."
command -v node >/dev/null 2>&1 || { echo 'Install standalone Node.js 22.13+ or 24 LTS, then run this script again.' >&2; exit 1; }
test -d node_modules/next || { echo 'Install project dependencies with pnpm install --frozen-lockfile first.' >&2; exit 1; }
export NEXT_TELEMETRY_DISABLED=1
exec node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1
