#!/bin/bash
# SW Portal Database Backup Script
# Usage: ./scripts/backup.sh
# Cron:  0 2 * * * /path/to/scripts/backup.sh >> /var/log/sw_portal_backup.log 2>&1

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_CONTAINER="${DB_CONTAINER:-sw_portal_db}"
DB_NAME="${POSTGRES_DB:-sw_portal}"
DB_USER="${POSTGRES_USER:-sw_portal}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/sw_portal_${TIMESTAMP}.sql.gz"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup..."

docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

echo "[$(date)] Backup saved to: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# Clean up old backups
find "$BACKUP_DIR" -name "sw_portal_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete
echo "[$(date)] Cleaned backups older than $RETENTION_DAYS days."
