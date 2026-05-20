#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${1:-}"

if [ -z "$BACKUP_DIR" ] || [ ! -d "$BACKUP_DIR" ]; then
  echo "Usage: ./scripts/local-restore.sh /absolute/path/to/.data/backups/<timestamp>"
  exit 1
fi

if [ ! -f "$ROOT_DIR/.env" ]; then
  echo "Missing .env file. Copy .env.example to .env first."
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required for restore."
  exit 1
fi

set -a
source "$ROOT_DIR/.env"
set +a

if [ -f "$BACKUP_DIR/database.sql" ]; then
  echo "Restoring PostgreSQL database..."
  psql "$DATABASE_URL" -f "$BACKUP_DIR/database.sql"
fi

if [ -f "$BACKUP_DIR/storage.tar.gz" ]; then
  echo "Restoring storage..."
  tar -xzf "$BACKUP_DIR/storage.tar.gz" -C "$ROOT_DIR"
fi

echo "Restore completed from $BACKUP_DIR"
