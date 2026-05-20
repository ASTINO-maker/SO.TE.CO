#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT_DIR/.data/backups/$TIMESTAMP"
STORAGE_DIR="$ROOT_DIR/storage"

if [ ! -f "$ROOT_DIR/.env" ]; then
  echo "Missing .env file. Copy .env.example to .env first."
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump is required for backups."
  exit 1
fi

mkdir -p "$BACKUP_DIR"

set -a
source "$ROOT_DIR/.env"
set +a

echo "Creating PostgreSQL backup..."
pg_dump "$DATABASE_URL" --no-owner --no-privileges > "$BACKUP_DIR/database.sql"

echo "Copying environment file..."
cp "$ROOT_DIR/.env" "$BACKUP_DIR/.env.backup"

if [ -d "$STORAGE_DIR" ]; then
  echo "Archiving storage..."
  tar -czf "$BACKUP_DIR/storage.tar.gz" -C "$ROOT_DIR" storage
fi

cat > "$BACKUP_DIR/README.txt" <<EOF
SO.TE.CO local backup
Created: $TIMESTAMP
Database dump: database.sql
Storage archive: storage.tar.gz
Environment copy: .env.backup
EOF

echo "Backup created in $BACKUP_DIR"
