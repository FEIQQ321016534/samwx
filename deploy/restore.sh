#!/bin/sh
set -eu
DEPLOY_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
TASK_BACKUP=${1:-}
case "$TASK_BACKUP" in *[!A-Za-z0-9._-]*|'') echo '用法: deploy/restore.sh 备份目录名' >&2; exit 2;; esac
TASK_STAMP=$(date -u +%Y%m%dT%H%M%SZ)
# Stop the real API container before starting a one-off restore container. No
# automatic restart on restore failure: leave the service stopped for inspection.
docker compose --env-file "$DEPLOY_DIR/.env" -f "$DEPLOY_DIR/compose.yaml" stop api
docker compose --env-file "$DEPLOY_DIR/.env" -f "$DEPLOY_DIR/compose.yaml" run --rm --no-deps -T api node /app/tools/restore-db.mjs --backup "/backups/$TASK_BACKUP" --database /data/sam.sqlite --media /data/media --offline-confirm --safety-output "/backups/before-restore-$TASK_STAMP"
echo '恢复完成，API仍保持停止。核对输出与安全快照后手动启动：'
echo 'docker compose --env-file deploy/.env -f deploy/compose.yaml up -d api'
echo '随后运行 deploy/check.sh，并抽查订单、余额和私有小票。'
