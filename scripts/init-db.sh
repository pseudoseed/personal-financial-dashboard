#!/bin/bash

# Database initialization script for Docker
# This script ensures the database is created with proper permissions

set -e

echo "Initializing database..."

# Set database URL for Docker environment
export DATABASE_URL="file:/app/data/dev.db"

# Create database directory if it doesn't exist
mkdir -p /app/data

# Initialize the database with Prisma
echo "Running Prisma database push..."
npx prisma db push --accept-data-loss

echo "Database initialization complete!" 