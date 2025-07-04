#!/bin/sh
set -e

# Ensure logs and backups directories exist
mkdir -p /app/logs
mkdir -p /app/backups

# Set up environment variables
export DATABASE_URL="file:/app/data/dev.db"
export NODE_ENV="production"

# Start the main app process with built-in scheduler
node server.js &
APP_PID=$!

# Wait for the app process to exit
wait $APP_PID

# Exit with the app's exit code
exit $? 