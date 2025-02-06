#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

# Change to project directory
cd "$PROJECT_DIR"

# Load environment variables
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    source "$PROJECT_DIR/.env"
    set +a
fi

# Set explicit paths for Node.js and npm
export PATH="/Users/emad/.nvm/versions/node/v20.14.0/bin:$PATH"

# Run the TypeScript script using ts-node with the correct configuration
if command -v node &> /dev/null; then
    echo "Using Node.js version: $(node -v)"
    echo "Node.js path: $(which node)"
    echo "Running script at $(date)"
    
    npx --no-install ts-node \
      --project "$SCRIPT_DIR/tsconfig.json" \
      --require tsconfig-paths/register \
      "$SCRIPT_DIR/refresh-data.ts" 2>&1
else
    echo "Node.js is not available in PATH" >&2
    echo "Current PATH: $PATH" >&2
    exit 1
fi 