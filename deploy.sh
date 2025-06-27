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

# Create database backup before deployment
create_backup_before_deploy() {
    print_status "Creating database backup before deployment..."
    
    if [ ! -d backups ]; then
        mkdir -p backups
    fi
    
    BACKUP_FILE="backups/pre-deploy-backup-$(date +%Y%m%d-%H%M%S).db"
    
    if docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
        print_status "Container is running, creating backup from container..."
        docker cp $CONTAINER_NAME:/app/data/dev.db $BACKUP_FILE
        print_success "Database backed up to: $BACKUP_FILE"
    else
        if [ -f data/dev.db ]; then
            print_status "Container not running, creating backup from local file..."
            cp data/dev.db $BACKUP_FILE
            print_success "Database backed up to: $BACKUP_FILE"
        else
            print_warning "No database file found to backup (this is normal for first deployment)"
        fi
    fi
}

# Clear Next.js cache
clear_next_cache() {
    print_status "Clearing Next.js build cache..."
    
    # Remove .next directory if it exists
    if [ -d .next ]; then
        rm -rf .next
        print_success "Next.js cache cleared"
    else
        print_status "No Next.js cache found to clear"
    fi
    
    # Remove node_modules/.cache if it exists
    if [ -d node_modules/.cache ]; then
        rm -rf node_modules/.cache
        print_success "Node modules cache cleared"
    fi
}

# Build and deploy with cache options
deploy() {
    local FORCE_REBUILD=false
    local CLEAR_CACHE=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force-rebuild)
                FORCE_REBUILD=true
                shift
                ;;
            --clear-cache)
                CLEAR_CACHE=true
                shift
                ;;
            --help)
                echo "Deploy options:"
                echo "  --force-rebuild    Force Docker to rebuild without using cache"
                echo "  --clear-cache      Clear Next.js and Node.js caches before build"
                echo "  --help            Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help for available options"
                exit 1
                ;;
        esac
    done
    
    print_status "Building and deploying Personal Finance Dashboard..."
    print_status "Using Docker Compose command: $DOCKER_COMPOSE"
    
    check_docker
    check_env
    
    # Create backup before deployment
    create_backup_before_deploy
    
    # Clear caches if requested
    if [ "$CLEAR_CACHE" = true ]; then
        clear_next_cache
    fi
    
    # Generate build arguments for cache invalidation
    local BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
    local VCS_REF=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    local VERSION=$(date +%Y%m%d-%H%M%S)
    local CACHE_BUST=$(date +%s)
    
    print_status "Build info:"
    echo "  Build Date: $BUILD_DATE"
    echo "  Git Commit: $VCS_REF"
    echo "  Version: $VERSION"
    echo "  Cache Bust: $CACHE_BUST"
    
    # Build the image with cache options and build arguments
    print_status "Building Docker image..."
    if [ "$FORCE_REBUILD" = true ]; then
        print_status "Forcing rebuild without cache..."
        docker build \
            --no-cache \
            --build-arg BUILD_DATE="$BUILD_DATE" \
            --build-arg VCS_REF="$VCS_REF" \
            --build-arg VERSION="$VERSION" \
            --build-arg CACHE_BUST="$CACHE_BUST" \
            -t $IMAGE_NAME .
    else
        docker build \
            --build-arg BUILD_DATE="$BUILD_DATE" \
            --build-arg VCS_REF="$VCS_REF" \
            --build-arg VERSION="$VERSION" \
            --build-arg CACHE_BUST="$CACHE_BUST" \
            -t $IMAGE_NAME .
    fi
    
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
    
    # Verify deployment
    verify_deployment
    
    print_success "Deployment completed successfully!"
    print_status "Dashboard is available at: http://localhost:3000"
    print_status "Smart refresh is enabled - data will refresh automatically when needed"
    print_status "Manual refresh is limited to 3 times per day to control costs"
}

# Verify deployment health
verify_deployment() {
    print_status "Verifying deployment..."
    
    # Check if container is running
    if ! docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
        print_error "Container is not running after deployment"
        print_status "Check logs with: $0 logs"
        exit 1
    fi
    
    # Check health endpoint
    local retries=0
    local max_retries=10
    
    while [ $retries -lt $max_retries ]; do
        if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
            print_success "Application health check passed"
            return 0
        else
            retries=$((retries + 1))
            print_status "Health check failed, retrying... ($retries/$max_retries)"
            sleep 5
        fi
    done
    
    print_error "Application failed to start properly after $max_retries attempts"
    print_status "Check logs with: $0 logs"
    exit 1
}

# Run full deployment verification
run_verification() {
    print_status "Running full deployment verification..."
    
    if [ -f scripts/verify-deployment.sh ]; then
        ./scripts/verify-deployment.sh full
    else
        print_warning "Verification script not found, running basic health check..."
        verify_deployment
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
    
    # Rebuild and deploy with cache clearing for updates
    deploy --clear-cache
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

# Clear all caches
clear_cache() {
    print_status "Clearing all caches..."
    
    # Clear Next.js cache
    clear_next_cache
    
    # Clear Docker build cache
    print_status "Clearing Docker build cache..."
    docker builder prune -f
    
    # Clear Docker system cache
    print_status "Clearing Docker system cache..."
    docker system prune -f
    
    print_success "All caches cleared"
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
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  deploy [OPTIONS]  - Build and deploy the application"
    echo "  logs             - Show application logs"
    echo "  status           - Show application status"
    echo "  stop             - Stop the application"
    echo "  restart          - Restart the application"
    echo "  update           - Update to latest version"
    echo "  backup           - Create database backup"
    echo "  clear-cache      - Clear all caches (Docker, Next.js, Node.js)"
    echo "  verify           - Run full deployment verification"
    echo "  refresh          - Manually run refresh"
    echo "  refresh_info     - Show refresh configuration"
    echo "  help             - Show this help message"
    echo ""
    echo "Deploy Options:"
    echo "  --force-rebuild  - Force Docker to rebuild without using cache"
    echo "  --clear-cache    - Clear Next.js and Node.js caches before build"
    echo ""
    echo "Examples:"
    echo "  $0 deploy                    - Deploy with normal caching"
    echo "  $0 deploy --force-rebuild    - Deploy with forced rebuild"
    echo "  $0 deploy --clear-cache      - Deploy with cache clearing"
    echo "  $0 logs                      - Show logs"
    echo "  $0 backup                    - Create database backup"
    echo "  $0 clear-cache               - Clear all caches"
    echo "  $0 verify                    - Run deployment verification"
    echo "  $0 refresh                   - Manually refresh data"
    echo ""
    echo "Cache Management:"
    echo "• Normal deployments use Docker layer caching for speed"
    echo "• Use --force-rebuild for major changes or cache issues"
    echo "• Use --clear-cache for UI/UX updates or build problems"
    echo "• Database is automatically backed up before each deployment"
    echo ""
    echo "Verification:"
    echo "• Use 'verify' command to check deployment health"
    echo "• Verifies container, database, volumes, and application health"
    echo "• Recommended after deployments to ensure everything is working"
    echo ""
    echo "Docker Compose Compatibility:"
    echo "  This script automatically detects and uses the appropriate Docker Compose command:"
    echo "  - Docker Compose v2: 'docker compose' (preferred)"
    echo "  - Docker Compose v1: 'docker-compose' (fallback)"
}

# Main script logic
case "${1:-help}" in
    deploy)
        shift
        deploy "$@"
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
    clear-cache)
        clear_cache
        ;;
    verify)
        run_verification
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