#!/bin/bash

# Deployment Verification Script for Personal Finance Dashboard
# This script verifies deployment health, data persistence, and database integrity

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CONTAINER_NAME="financial-dashboard"
HEALTH_ENDPOINT="http://localhost:3000/api/health"

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
        print_error "Docker is not running"
        return 1
    fi
    return 0
}

# Check container status
check_container_status() {
    print_status "Checking container status..."
    
    if ! docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
        print_error "Container is not running"
        return 1
    fi
    
    local container_id=$(docker ps -q -f name=$CONTAINER_NAME)
    local container_status=$(docker inspect --format='{{.State.Status}}' $container_id 2>/dev/null)
    
    if [ "$container_status" = "running" ]; then
        print_success "Container is running (ID: $container_id)"
        return 0
    else
        print_error "Container is not in running state: $container_status"
        return 1
    fi
}

# Check application health
check_application_health() {
    print_status "Checking application health..."
    
    local retries=0
    local max_retries=5
    
    while [ $retries -lt $max_retries ]; do
        if curl -f -s $HEALTH_ENDPOINT > /dev/null 2>&1; then
            print_success "Application health check passed"
            return 0
        else
            retries=$((retries + 1))
            print_status "Health check failed, retrying... ($retries/$max_retries)"
            sleep 2
        fi
    done
    
    print_error "Application health check failed after $max_retries attempts"
    return 1
}

# Check database persistence
check_database_persistence() {
    print_status "Checking database persistence..."
    
    # Check if database file exists in container
    if docker exec $CONTAINER_NAME test -f /app/data/dev.db 2>/dev/null; then
        print_success "Database file exists in container"
    else
        print_error "Database file not found in container"
        return 1
    fi
    
    # Check database file size
    local db_size=$(docker exec $CONTAINER_NAME stat -c%s /app/data/dev.db 2>/dev/null || echo "0")
    if [ "$db_size" -gt 0 ]; then
        print_success "Database file size: $db_size bytes"
    else
        print_warning "Database file appears to be empty"
    fi
    
    # Check if we can connect to the database
    if docker exec $CONTAINER_NAME sqlite3 /app/data/dev.db "SELECT COUNT(*) FROM sqlite_master;" > /dev/null 2>&1; then
        print_success "Database connection test passed"
    else
        print_error "Database connection test failed"
        return 1
    fi
    
    return 0
}

# Check data integrity
check_data_integrity() {
    print_status "Checking data integrity..."
    
    # Check for critical tables
    local tables=("PlaidItem" "Account" "AccountBalance" "Transaction")
    local missing_tables=()
    
    for table in "${tables[@]}"; do
        if docker exec $CONTAINER_NAME sqlite3 /app/data/dev.db "SELECT name FROM sqlite_master WHERE type='table' AND name='$table';" 2>/dev/null | grep -q "$table"; then
            print_success "Table '$table' exists"
        else
            print_warning "Table '$table' not found"
            missing_tables+=("$table")
        fi
    done
    
    # Check for data in critical tables
    if [ ${#missing_tables[@]} -eq 0 ]; then
        local account_count=$(docker exec $CONTAINER_NAME sqlite3 /app/data/dev.db "SELECT COUNT(*) FROM Account;" 2>/dev/null || echo "0")
        local balance_count=$(docker exec $CONTAINER_NAME sqlite3 /app/data/dev.db "SELECT COUNT(*) FROM AccountBalance;" 2>/dev/null || echo "0")
        local transaction_count=$(docker exec $CONTAINER_NAME sqlite3 /app/data/dev.db "SELECT COUNT(*) FROM Transaction;" 2>/dev/null || echo "0")
        
        echo "  • Accounts: $account_count"
        echo "  • Balance records: $balance_count"
        echo "  • Transactions: $transaction_count"
        
        if [ "$account_count" -gt 0 ] || [ "$balance_count" -gt 0 ] || [ "$transaction_count" -gt 0 ]; then
            print_success "Data integrity check passed"
        else
            print_warning "No data found in critical tables (this may be normal for new deployments)"
        fi
    else
        print_warning "Some critical tables are missing: ${missing_tables[*]}"
    fi
}

# Check volume mounts
check_volume_mounts() {
    print_status "Checking volume mounts..."
    
    # Check if data volume is mounted
    if docker exec $CONTAINER_NAME test -d /app/data 2>/dev/null; then
        print_success "Data volume is mounted"
    else
        print_error "Data volume is not mounted"
        return 1
    fi
    
    # Check if logs volume is mounted
    if docker exec $CONTAINER_NAME test -d /app/logs 2>/dev/null; then
        print_success "Logs volume is mounted"
    else
        print_error "Logs volume is not mounted"
        return 1
    fi
    
    # Check if backups volume is mounted
    if docker exec $CONTAINER_NAME test -d /app/backups 2>/dev/null; then
        print_success "Backups volume is mounted"
    else
        print_error "Backups volume is not mounted"
        return 1
    fi
    
    return 0
}

# Check resource usage
check_resource_usage() {
    print_status "Checking resource usage..."
    
    local stats=$(docker stats --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" $CONTAINER_NAME 2>/dev/null || echo "")
    
    if [ -n "$stats" ]; then
        echo "$stats" | tail -1 | while read cpu mem mem_perc; do
            echo "  • CPU Usage: $cpu"
            echo "  • Memory Usage: $mem ($mem_perc)"
        done
        print_success "Resource usage check completed"
    else
        print_warning "Could not retrieve resource usage"
    fi
}

# Check recent logs for errors
check_recent_logs() {
    print_status "Checking recent logs for errors..."
    
    local error_count=$(docker logs --since 10m $CONTAINER_NAME 2>&1 | grep -i "error\|exception\|failed" | wc -l)
    
    if [ "$error_count" -eq 0 ]; then
        print_success "No errors found in recent logs"
    else
        print_warning "Found $error_count potential errors in recent logs"
        echo "Recent errors:"
        docker logs --since 10m $CONTAINER_NAME 2>&1 | grep -i "error\|exception\|failed" | tail -5
    fi
}

# Perform full verification
full_verification() {
    print_status "Starting full deployment verification..."
    echo ""
    
    local all_checks_passed=true
    
    # Check Docker
    if ! check_docker; then
        all_checks_passed=false
    fi
    echo ""
    
    # Check container
    if ! check_container_status; then
        all_checks_passed=false
    fi
    echo ""
    
    # Check application health
    if ! check_application_health; then
        all_checks_passed=false
    fi
    echo ""
    
    # Check volume mounts
    if ! check_volume_mounts; then
        all_checks_passed=false
    fi
    echo ""
    
    # Check database persistence
    if ! check_database_persistence; then
        all_checks_passed=false
    fi
    echo ""
    
    # Check data integrity
    check_data_integrity
    echo ""
    
    # Check resource usage
    check_resource_usage
    echo ""
    
    # Check recent logs
    check_recent_logs
    echo ""
    
    # Summary
    if [ "$all_checks_passed" = true ]; then
        print_success "All critical checks passed! Deployment is healthy."
        return 0
    else
        print_error "Some critical checks failed. Please review the issues above."
        return 1
    fi
}

# Quick health check
quick_health_check() {
    print_status "Performing quick health check..."
    
    if check_docker && check_container_status && check_application_health; then
        print_success "Quick health check passed"
        return 0
    else
        print_error "Quick health check failed"
        return 1
    fi
}

# Show help
help() {
    echo "Deployment Verification Script for Personal Finance Dashboard"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  full            - Perform full deployment verification"
    echo "  quick           - Perform quick health check only"
    echo "  container       - Check container status only"
    echo "  health          - Check application health only"
    echo "  database        - Check database persistence only"
    echo "  volumes         - Check volume mounts only"
    echo "  resources       - Check resource usage only"
    echo "  logs            - Check recent logs for errors"
    echo "  help            - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 full         - Full verification (recommended)"
    echo "  $0 quick        - Quick health check"
    echo "  $0 database     - Database-specific checks"
    echo ""
    echo "Verification includes:"
    echo "• Container status and health"
    echo "• Application endpoint availability"
    echo "• Database persistence and integrity"
    echo "• Volume mount verification"
    echo "• Resource usage monitoring"
    echo "• Error log analysis"
}

# Main script logic
case "${1:-help}" in
    full)
        full_verification
        ;;
    quick)
        quick_health_check
        ;;
    container)
        check_container_status
        ;;
    health)
        check_application_health
        ;;
    database)
        check_database_persistence
        check_data_integrity
        ;;
    volumes)
        check_volume_mounts
        ;;
    resources)
        check_resource_usage
        ;;
    logs)
        check_recent_logs
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