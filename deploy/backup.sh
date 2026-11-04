#!/bin/sh
set -eu
DEPLOY_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
TASK_STAMP=$(date -u +%Y%m%dT%H%M%SZ)
TASK_NAME=${1:-sam-$TASK_STAMP}
case "$TASK_NAME" in *[!A-Za-z0-9._-]*|'') echo '备份名只允许英文字母、数字、点、下划线和短横线' >&2; exit 2;; esac
docker compose --env-file "$DEPLOY_DIR/.env" -f "$DEPLOY_DIR/compose.yaml" exec -T api node /app/tools/backup-db.mjs --database /data/sam.sqlite --media /data/media --output "/backups/$TASK_NAME"
