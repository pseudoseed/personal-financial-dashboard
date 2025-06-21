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

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not available" >&2
    exit 1
fi

echo "Using Node.js version: $(node -v)"
echo "Node.js path: $(which node)"

# Run the TypeScript script
echo "Running refresh-data.ts..."
npx --no-install ts-node \
  --project "$SCRIPT_DIR/tsconfig.json" \
  --require tsconfig-paths/register \
  "$SCRIPT_DIR/refresh-data.ts" 2>&1

# Log completion
echo "=== Refresh completed at $(date) ==="
echo "" 