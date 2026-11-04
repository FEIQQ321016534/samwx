#!/bin/sh
set -eu
DEPLOY_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
docker compose --env-file "$DEPLOY_DIR/.env" -f "$DEPLOY_DIR/compose.yaml" exec -T api node /app/tools/healthcheck.mjs --url http://127.0.0.1:8787/api --production
