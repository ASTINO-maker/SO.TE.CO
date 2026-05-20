#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env.web}"
BACKUP_ROOT="${BACKUP_ROOT:-backups/web}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="${BACKUP_ROOT}/${TIMESTAMP}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing ${ENV_FILE}. Copy .env.web.example to .env.web first." >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

mkdir -p "$BACKUP_DIR"

docker compose --env-file "$ENV_FILE" -f docker-compose.web.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "${BACKUP_DIR}/database.sql"

docker compose --env-file "$ENV_FILE" -f docker-compose.web.yml run --rm --no-deps --entrypoint sh api \
  -c "cd /app && tar -czf - storage" > "${BACKUP_DIR}/storage.tar.gz"

cp "$ENV_FILE" "${BACKUP_DIR}/env.web.copy"

echo "Backup written to ${BACKUP_DIR}"
