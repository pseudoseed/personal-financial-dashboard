#!/bin/bash

# Database initialization script for Docker
# This script ensures the database is created with proper permissions

set -e

echo "Initializing database..."

# Set database URL for Docker environment
export DATABASE_URL="file:/app/data/dev.db"

# Create database directory if it doesn't exist (without chown)
echo "Creating database directory..."
mkdir -p /app/data

# Check if database file exists
if [ -f /app/data/dev.db ]; then
    echo "Database file exists, checking schema..."
    # Use migrate deploy for existing databases
    npx prisma migrate deploy
else
    echo "Creating new database..."
    # Use migrate deploy for new databases
    npx prisma migrate deploy
fi

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Create default user if it doesn't exist
echo "Creating default user..."
npx prisma db execute --url "$DATABASE_URL" --stdin <<< "
INSERT OR IGNORE INTO users (id, email, name, createdAt, updatedAt) 
VALUES ('default', 'default@example.com', 'Default User', datetime('now'), datetime('now'));
"

# Verify database is accessible
echo "Verifying database connection..."
npx prisma db execute --url "$DATABASE_URL" --stdin <<< "SELECT COUNT(*) as user_count FROM users;"

echo "Database initialization complete!"
echo "Database file: /app/data/dev.db" 