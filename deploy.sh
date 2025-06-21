#!/bin/bash

# Personal Financial Dashboard Deployment Script
# This script helps manage the Docker deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check if .env file exists
check_env() {
    if [ ! -f .env ]; then
        print_error ".env file not found! Please create one based on .env.example"
        exit 1
    fi
    print_success ".env file found"
}

# Create necessary directories
setup_directories() {
    print_status "Creating necessary directories..."
    mkdir -p data logs
    print_success "Directories created"
}

# Build and start the application
deploy() {
    print_status "Building and starting the application..."
    docker-compose up -d --build
    print_success "Application deployed successfully!"
    print_status "The dashboard should be available at http://localhost:3000"
}

# Stop the application
stop() {
    print_status "Stopping the application..."
    docker-compose down
    print_success "Application stopped"
}

# Restart the application
restart() {
    print_status "Restarting the application..."
    docker-compose restart
    print_success "Application restarted"
}

# Update the application
update() {
    print_status "Pulling latest changes and rebuilding..."
    git pull
    docker-compose down
    docker-compose up -d --build
    print_success "Application updated successfully!"
}

# Show logs
logs() {
    print_status "Showing application logs..."
    docker-compose logs -f
}

# Show status
status() {
    print_status "Application status:"
    docker-compose ps
    echo ""
    print_status "Container health:"
    docker-compose exec financial-dashboard curl -s http://localhost:3000/api/health | jq . 2>/dev/null || echo "Health check not available"
}

# Backup database
backup() {
    print_status "Creating database backup..."
    timestamp=$(date +%Y%m%d_%H%M%S)
    backup_file="backup_${timestamp}.db"
    cp data/dev.db "backups/${backup_file}" 2>/dev/null || mkdir -p backups && cp data/dev.db "backups/${backup_file}"
    print_success "Database backed up to backups/${backup_file}"
}

# Show help
show_help() {
    echo "Personal Financial Dashboard Deployment Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  deploy    - Build and start the application"
    echo "  stop      - Stop the application"
    echo "  restart   - Restart the application"
    echo "  update    - Pull latest changes and rebuild"
    echo "  logs      - Show application logs"
    echo "  status    - Show application status"
    echo "  backup    - Create database backup"
    echo "  help      - Show this help message"
    echo ""
}

# Main script logic
case "${1:-deploy}" in
    deploy)
        check_env
        setup_directories
        deploy
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    update)
        check_env
        update
        ;;
    logs)
        logs
        ;;
    status)
        status
        ;;
    backup)
        backup
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac 