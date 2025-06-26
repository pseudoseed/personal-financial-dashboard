#!/bin/bash

# Personal Finance Dashboard Deployment Script
# This script helps deploy and manage the Personal Financial Dashboard

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CONTAINER_NAME="financial-dashboard"
IMAGE_NAME="personal-finance-dashboard"

# Detect Docker Compose command
detect_docker_compose() {
    # Try docker compose (v2) first
    if docker compose version > /dev/null 2>&1; then
        echo "docker compose"
        return 0
    fi
    
    # Fall back to docker-compose (v1)
    if docker-compose --version > /dev/null 2>&1; then
        echo "docker-compose"
        return 0
    fi
    
    # Neither command found
    return 1
}

# Set Docker Compose command
DOCKER_COMPOSE=$(detect_docker_compose)
if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR]${NC} Docker Compose is not available. Please install Docker Compose and try again."
    echo "Supported versions:"
    echo "  - Docker Compose v2: 'docker compose'"
    echo "  - Docker Compose v1: 'docker-compose'"
    exit 1
fi

# Helper functions
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

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Check if .env file exists
check_env() {
    if [ ! -f .env ]; then
        print_warning ".env file not found. Creating from template..."
        if [ -f env.example ]; then
            cp env.example .env
            print_warning "Please edit .env file with your actual configuration values."
            print_warning "Required variables: PLAID_CLIENT_ID, PLAID_SECRET, COINBASE_CLIENT_ID, COINBASE_CLIENT_SECRET"
            exit 1
        else
            print_error "No .env file or env.example template found. Please create .env file manually."
            exit 1
        fi
    fi
}

# Build and deploy
deploy() {
    print_status "Building and deploying Personal Finance Dashboard..."
    print_status "Using Docker Compose command: $DOCKER_COMPOSE"
    
    check_docker
    check_env
    
    # Build the image
    print_status "Building Docker image..."
    docker build -t $IMAGE_NAME .
    
    # Stop existing container if running
    if docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
        print_status "Stopping existing container..."
        $DOCKER_COMPOSE down
    fi
    
    # Start the application
    print_status "Starting application..."
    $DOCKER_COMPOSE up -d
    
    # Wait for the application to be ready
    print_status "Waiting for application to start..."
    sleep 15
    
    # Check if the application is running
    if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
        print_success "Application is running successfully!"
        print_status "Dashboard is available at: http://localhost:3000"
        print_status "Smart refresh is enabled - data will refresh automatically when needed"
        print_status "Manual refresh is limited to 3 times per day to control costs"
    else
        print_error "Application failed to start properly"
        print_status "Check logs with: $0 logs"
        exit 1
    fi
}

# Show logs
logs() {
    print_status "Showing application logs..."
    $DOCKER_COMPOSE logs -f
}

# Show status
status() {
    print_status "Application status:"
    if docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
        print_success "Container is running"
        echo "Container ID: $(docker ps -q -f name=$CONTAINER_NAME)"
        echo "Port: 3000"
        echo "Health check: $(curl -s http://localhost:3000/api/health || echo 'Not responding')"
        
        # Show resource usage
        echo ""
        print_status "Resource usage:"
        docker stats --no-stream $CONTAINER_NAME
    else
        print_warning "Container is not running"
    fi
}

# Stop the application
stop() {
    print_status "Stopping application..."
    $DOCKER_COMPOSE down
    print_success "Application stopped"
}

# Restart the application
restart() {
    print_status "Restarting application..."
    $DOCKER_COMPOSE restart
    print_success "Application restarted"
}

# Update to latest version
update() {
    print_status "Updating to latest version..."
    
    # Pull latest changes (if using git)
    if [ -d .git ]; then
        print_status "Pulling latest changes..."
        git pull origin main
    fi
    
    # Rebuild and deploy
    deploy
}

# Backup database
backup() {
    print_status "Creating database backup..."
    
    if [ ! -d backups ]; then
        mkdir -p backups
    fi
    
    BACKUP_FILE="backups/backup-$(date +%Y%m%d-%H%M%S).db"
    
    if docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
        docker cp $CONTAINER_NAME:/app/data/dev.db $BACKUP_FILE
        print_success "Database backed up to: $BACKUP_FILE"
    else
        if [ -f data/dev.db ]; then
            cp data/dev.db $BACKUP_FILE
            print_success "Database backed up to: $BACKUP_FILE"
        else
            print_error "No database file found to backup"
        fi
    fi
}

# Manually run refresh
refresh() {
    print_status "Manually running refresh..."
    curl -X POST http://localhost:3000/api/accounts/refresh \
        -H "Content-Type: application/json" \
        -d '{"manual": true, "userId": "default"}' \
        -s | jq '.' || echo "Refresh endpoint not available"
    print_success "Refresh completed"
}

# Show refresh info
refresh_info() {
    print_status "Smart Refresh Configuration:"
    echo "• Auto-refresh: Enabled on page load (if data is >6 hours old)"
    echo "• Manual refresh: Limited to 3 times per day"
    echo "• Cache TTL: 2-24 hours based on account activity"
    echo "• Rate limiting: Prevents excessive API calls"
    echo ""
    print_status "Cost Optimization Features:"
    echo "• Smart caching reduces redundant requests"
    echo "• Batch processing by institution"
    echo "• Rate limiting prevents abuse"
}

# Show help
help() {
    echo "Personal Finance Dashboard Management Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  deploy      - Build and deploy the application"
    echo "  logs        - Show application logs"
    echo "  status      - Show application status"
    echo "  stop        - Stop the application"
    echo "  restart     - Restart the application"
    echo "  update      - Update to latest version"
    echo "  backup      - Create database backup"
    echo "  refresh     - Manually run refresh"
    echo "  refresh_info - Show refresh configuration"
    echo "  help        - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 deploy   - Deploy the application"
    echo "  $0 logs     - Show logs"
    echo "  $0 backup   - Create database backup"
    echo "  $0 refresh  - Manually refresh data"
    echo ""
    echo "Docker Compose Compatibility:"
    echo "  This script automatically detects and uses the appropriate Docker Compose command:"
    echo "  - Docker Compose v2: 'docker compose' (preferred)"
    echo "  - Docker Compose v1: 'docker-compose' (fallback)"
}

# Main script logic
case "${1:-help}" in
    deploy)
        deploy
        ;;
    logs)
        logs
        ;;
    status)
        status
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    update)
        update
        ;;
    backup)
        backup
        ;;
    refresh)
        refresh
        ;;
    refresh_info)
        refresh_info
        ;;
    help|--help|-h)
        help
        ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        help
        exit 1
        ;;
esac 