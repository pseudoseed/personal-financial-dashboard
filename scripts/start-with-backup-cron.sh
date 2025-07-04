#!/bin/sh
set -e

# Ensure logs and backups directories exist
mkdir -p /app/logs
mkdir -p /app/backups

# Write out the cron job (idempotent)
CRON_FILE=/etc/cron.d/access-token-backup
BACKUP_CMD="cd /app && /usr/local/bin/node /app/scripts/backup-access-tokens.js >> /app/logs/access-token-backup.log 2>&1"
echo "0 2 * * * root $BACKUP_CMD" > $CRON_FILE
chmod 0644 $CRON_FILE

# Ensure cron is running in the foreground (for Docker best practices)
# Start cron in the background
crond

# Start the main app process
node server.js &
APP_PID=$!

# Wait for the app process to exit
wait $APP_PID

# Exit with the app's exit code
exit $? 