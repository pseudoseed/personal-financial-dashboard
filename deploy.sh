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

# Check if docker compose is available
check_docker_compose() {
    if docker compose version >/dev/null 2>&1; then
        DOCKER_COMPOSE="docker compose"
        print_success "Using 'docker compose' (modern version)"
    elif docker-compose --version >/dev/null 2>&1; then
        DOCKER_COMPOSE="docker-compose"
        print_success "Using 'docker-compose' (legacy version)"
    else
        print_error "Neither 'docker compose' nor 'docker-compose' is available"
        print_error "Please install Docker Compose or ensure Docker is properly installed"
        exit 1
    fi
}

# Create necessary directories
setup_directories() {
    print_status "Creating necessary directories..."
    mkdir -p data logs backups
    print_success "Directories created"
    
    # Set proper permissions for Docker container (user 1001:1001)
    print_status "Setting directory permissions..."
    chmod 755 data logs backups
    print_success "Directory permissions set"
}

# Build and start the application
deploy() {
    print_status "Building and starting the application..."
    $DOCKER_COMPOSE up -d --build
    print_success "Application deployed successfully!"
    print_status "The dashboard should be available at http://localhost:3000"
    print_status "Cron job is scheduled to run daily at 6 AM"
}

# Stop the application
stop() {
    print_status "Stopping the application..."
    $DOCKER_COMPOSE down
    print_success "Application stopped"
}

# Restart the application
restart() {
    print_status "Restarting the application..."
    $DOCKER_COMPOSE restart
    print_success "Application restarted"
}

# Update the application
update() {
    print_status "Pulling latest changes and rebuilding..."
    git pull
    $DOCKER_COMPOSE down
    $DOCKER_COMPOSE up -d --build
    print_success "Application updated successfully!"
}

# Show logs
logs() {
    print_status "Showing application logs..."
    $DOCKER_COMPOSE logs -f
}

# Show cron logs
cron_logs() {
    print_status "Showing cron job logs..."
    if [ -f "logs/cron.log" ]; then
        tail -f logs/cron.log
    else
        print_warning "No cron logs found yet. Cron job runs daily at 6 AM."
    fi
}

# Show status
status() {
    print_status "Application status:"
    $DOCKER_COMPOSE ps
    echo ""
    print_status "Container health:"
    $DOCKER_COMPOSE exec financial-dashboard curl -s http://localhost:3000/api/health | jq . 2>/dev/null || echo "Health check not available"
    echo ""
    print_status "Cron job status:"
    if [ -f "logs/cron.log" ]; then
        echo "Last cron run: $(tail -n 1 logs/cron.log | cut -d' ' -f1-3 2>/dev/null || echo 'No runs yet')"
    else
        echo "No cron logs found yet"
    fi
}

# Backup database
backup() {
    print_status "Creating database backup..."
    timestamp=$(date +%Y%m%d_%H%M%S)
    backup_file="backup_${timestamp}.db"
    cp data/dev.db "backups/${backup_file}" 2>/dev/null || mkdir -p backups && cp data/dev.db "backups/${backup_file}"
    print_success "Database backed up to backups/${backup_file}"
}

# Manually run refresh
refresh() {
    print_status "Manually running refresh script..."
    $DOCKER_COMPOSE exec financial-dashboard /app/scripts/refresh-data-docker.sh
    print_success "Refresh completed"
}

# Show cron schedule
cron_schedule() {
    print_status "Current cron schedule:"
    echo "Daily at 6:00 AM - Refresh all account balances and transactions"
    echo ""
    print_status "To modify the schedule, edit the Dockerfile and rebuild:"
    echo "1. Edit the cron line in Dockerfile (line with '0 6 * * *')"
    echo "2. Run: ./deploy.sh update"
    echo ""
    print_status "Common cron patterns:"
    echo "0 6 * * *     - Daily at 6 AM (current)"
    echo "0 */6 * * *   - Every 6 hours"
    echo "0 6,18 * * *  - Twice daily at 6 AM and 6 PM"
    echo "0 6 * * 1-5   - Weekdays only at 6 AM"
}

# Show help
show_help() {
    echo "Personal Financial Dashboard Deployment Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  deploy        - Build and start the application"
    echo "  stop          - Stop the application"
    echo "  restart       - Restart the application"
    echo "  update        - Pull latest changes and rebuild"
    echo "  logs          - Show application logs"
    echo "  cron_logs     - Show cron job logs"
    echo "  status        - Show application status"
    echo "  backup        - Create database backup"
    echo "  refresh       - Manually run refresh script"
    echo "  cron_schedule - Show cron schedule and options"
    echo "  help          - Show this help message"
    echo ""
}

# Main script logic
case "${1:-deploy}" in
    deploy)
        check_env
        check_docker_compose
        setup_directories
        deploy
        ;;
    stop)
        check_docker_compose
        stop
        ;;
    restart)
        check_docker_compose
        restart
        ;;
    update)
        check_env
        check_docker_compose
        update
        ;;
    logs)
        check_docker_compose
        logs
        ;;
    cron_logs)
        cron_logs
        ;;
    status)
        check_docker_compose
        status
        ;;
    backup)
        backup
        ;;
    refresh)
        check_docker_compose
        refresh
        ;;
    cron_schedule)
        cron_schedule
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