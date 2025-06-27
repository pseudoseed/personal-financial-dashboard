#!/bin/bash

# Database initialization script for Personal Finance Dashboard
# This script ensures the database is created with proper permissions
# Works on both Docker and local Linux environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Detect if running in Docker
is_docker() {
    [ -f /.dockerenv ] || [ -f /proc/1/cgroup ] && grep -q docker /proc/1/cgroup
}

# Get the appropriate database path
get_database_path() {
    if is_docker; then
        echo "/app/data/dev.db"
    else
        echo "./data/dev.db"
    fi
}

# Get the appropriate data directory
get_data_directory() {
    if is_docker; then
        echo "/app/data"
    else
        echo "./data"
    fi
}

# Validate and create directories with proper permissions
setup_directories() {
    local data_dir=$(get_data_directory)
    
    print_status "Setting up directories..."
    
    # Create data directory if it doesn't exist
    if [ ! -d "$data_dir" ]; then
        print_status "Creating data directory: $data_dir"
        mkdir -p "$data_dir"
    fi
    
    # Set proper permissions for data directory
    if is_docker; then
        # In Docker, ensure nextjs user has access
        if [ -w "$data_dir" ]; then
            print_status "Setting ownership for Docker environment..."
            chown -R nextjs:nodejs "$data_dir" 2>/dev/null || true
        fi
    else
        # On local Linux, ensure current user has write access
        if [ ! -w "$data_dir" ]; then
            print_error "Data directory is not writable: $data_dir"
            print_error "Please check permissions and try again"
            exit 1
        fi
    fi
    
    print_success "Directory setup complete"
}

# Validate environment
validate_environment() {
    print_status "Validating environment..."
    
    # Check if Node.js is available
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed or not in PATH"
        exit 1
    fi
    
    # Check if npm is available
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed or not in PATH"
        exit 1
    fi
    
    # Check if npx is available
    if ! command -v npx &> /dev/null; then
        print_error "npx is not available"
        exit 1
    fi
    
    # Check if Prisma is available
    if ! npx prisma --version &> /dev/null; then
        print_error "Prisma CLI is not available"
        print_status "Installing Prisma CLI..."
        npm install -g prisma
    fi
    
    print_success "Environment validation complete"
}

# Initialize database
initialize_database() {
    local db_path=$(get_database_path)
    local data_dir=$(get_data_directory)
    
    print_status "Initializing database..."
    
    # Set database URL for the current environment
    if is_docker; then
        export DATABASE_URL="file:/app/data/dev.db"
    else
        export DATABASE_URL="file:./data/dev.db"
    fi
    
    print_status "Using database: $db_path"
    print_status "Database URL: $DATABASE_URL"
    
    # Check if database file exists
    if [ -f "$db_path" ]; then
        print_status "Database file exists, checking schema..."
        # Use migrate deploy for existing databases
        npx prisma migrate deploy
    else
        print_status "Creating new database..."
        # Use migrate deploy for new databases
        npx prisma migrate deploy
    fi
    
    # Generate Prisma client
    print_status "Generating Prisma client..."
    npx prisma generate
    
    # Create default user if it doesn't exist
    print_status "Creating default user..."
    npx prisma db execute --url "$DATABASE_URL" --stdin <<< "
INSERT OR IGNORE INTO users (id, email, name, createdAt, updatedAt) 
VALUES ('default', 'default@example.com', 'Default User', datetime('now'), datetime('now'));
"
    
    # Verify database is accessible
    print_status "Verifying database connection..."
    local user_count=$(npx prisma db execute --url "$DATABASE_URL" --stdin <<< "SELECT COUNT(*) as user_count FROM users;" | grep -o '[0-9]*' | head -1)
    
    if [ "$user_count" -gt 0 ]; then
        print_success "Database connection verified ($user_count users found)"
    else
        print_warning "Database connection verified but no users found"
    fi
    
    print_success "Database initialization complete!"
    print_status "Database file: $db_path"
}

# Warn if stray DB files exist in prisma/
if compgen -G "./prisma/*.db" > /dev/null || compgen -G "./prisma/data/*.db" > /dev/null; then
    print_warning "Stray .db files found in prisma/ or prisma/data/. These are not used in production and may cause confusion."
    print_warning "Please remove them: rm -f prisma/*.db prisma/data/*.db"
fi

# Main execution
main() {
    print_status "Starting database initialization..."
    print_status "Environment: $(is_docker && echo 'Docker' || echo 'Local Linux')"
    
    validate_environment
    setup_directories
    initialize_database
    
    print_success "Database initialization completed successfully!"
}

# Run main function
main "$@" 