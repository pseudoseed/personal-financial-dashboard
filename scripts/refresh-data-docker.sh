#!/bin/bash

# Docker-specific refresh script for cron jobs
# This script is designed to run inside the Docker container

set -e

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

# Change to project directory
cd "$PROJECT_DIR"

# Load environment variables from .env file
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    source "$PROJECT_DIR/.env"
    set +a
fi

# Set database URL for Docker environment
export DATABASE_URL="file:/app/data/dev.db"

# Log start time
echo "=== Starting refresh at $(date) ==="

# Check if curl is available
if ! command -v curl &> /dev/null; then
    echo "ERROR: curl is not available" >&2
    exit 1
fi

echo "Using curl to trigger refresh endpoints..."

# Trigger account refresh via API
echo "Triggering account refresh..."
curl -X POST http://localhost:3000/api/accounts/refresh 2>/dev/null || echo "Account refresh endpoint not available"

# Trigger transaction sync for all accounts
echo "Triggering transaction sync..."
curl -X POST http://localhost:3000/api/accounts/sync 2>/dev/null || echo "Transaction sync endpoint not available"

# Log completion
echo "=== Refresh completed at $(date) ==="
echo "" 