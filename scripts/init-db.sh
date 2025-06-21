#!/bin/bash

# Database initialization script for Docker
# This script ensures the database is created with proper permissions

set -e

echo "Initializing database..."

# Set database URL for Docker environment
export DATABASE_URL="file:/app/data/dev.db"

# Create database directory if it doesn't exist
mkdir -p /app/data

# Run Prisma migrations
npx prisma migrate deploy

# Create default user if it doesn't exist
echo "Creating default user..."
npx prisma db execute --stdin <<< "
INSERT OR IGNORE INTO users (id, email, name, createdAt, updatedAt) 
VALUES ('default', 'default@example.com', 'Default User', datetime('now'), datetime('now'));
"

echo "Database initialization complete!" 