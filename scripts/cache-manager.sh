#!/bin/bash

# Cache Management Utility for Personal Finance Dashboard
# This script provides comprehensive cache clearing and verification tools

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CONTAINER_NAME="financial-dashboard"

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

# Clear Next.js cache
clear_next_cache() {
    print_status "Clearing Next.js build cache..."
    
    local cleared=false
    
    # Remove .next directory if it exists
    if [ -d .next ]; then
        rm -rf .next
        print_success "Next.js cache (.next) cleared"
        cleared=true
    fi
    
    # Remove node_modules/.cache if it exists
    if [ -d node_modules/.cache ]; then
        rm -rf node_modules/.cache
        print_success "Node modules cache cleared"
        cleared=true
    fi
    
    # Remove .turbo if it exists (Turbopack cache)
    if [ -d .turbo ]; then
        rm -rf .turbo
        print_success "Turbopack cache (.turbo) cleared"
        cleared=true
    fi
    
    if [ "$cleared" = false ]; then
        print_status "No Next.js cache found to clear"
    fi
}

# Clear Docker cache
clear_docker_cache() {
    print_status "Clearing Docker cache..."
    
    # Clear build cache
    print_status "Clearing Docker build cache..."
    docker builder prune -f
    
    # Clear system cache
    print_status "Clearing Docker system cache..."
    docker system prune -f
    
    # Clear unused images
    print_status "Clearing unused Docker images..."
    docker image prune -f
    
    print_success "Docker cache cleared"
}

# Clear browser cache (informational)
clear_browser_cache_info() {
    print_status "Browser Cache Information:"
    echo "• Static assets are cached with versioned URLs"
    echo "• API responses have no-cache headers"
    echo "• HTML pages have short cache (5 minutes)"
    echo ""
    print_status "To clear browser cache:"
    echo "• Chrome/Edge: Ctrl+Shift+R (hard refresh)"
    echo "• Firefox: Ctrl+F5 (hard refresh)"
    echo "• Safari: Cmd+Option+R (hard refresh)"
    echo "• Or clear browser data manually"
}

# Verify cache status
verify_cache_status() {
    print_status "Verifying cache status..."
    
    echo ""
    print_status "Next.js Cache Status:"
    if [ -d .next ]; then
        echo "  • .next directory exists (build cache present)"
        echo "  • Size: $(du -sh .next 2>/dev/null | cut -f1 || echo 'unknown')"
    else
        echo "  • .next directory not found (no build cache)"
    fi
    
    if [ -d node_modules/.cache ]; then
        echo "  • node_modules/.cache exists"
        echo "  • Size: $(du -sh node_modules/.cache 2>/dev/null | cut -f1 || echo 'unknown')"
    else
        echo "  • node_modules/.cache not found"
    fi
    
    echo ""
    print_status "Docker Cache Status:"
    echo "  • Build cache: $(docker builder du 2>/dev/null | tail -1 || echo 'unknown')"
    echo "  • System cache: $(docker system df 2>/dev/null | grep 'Total Space' | awk '{print $3}' || echo 'unknown')"
    
    echo ""
    print_status "Container Status:"
    if docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
        echo "  • Container is running"
        echo "  • Container ID: $(docker ps -q -f name=$CONTAINER_NAME)"
    else
        echo "  • Container is not running"
    fi
}

# Check for cache issues
check_cache_issues() {
    print_status "Checking for potential cache issues..."
    
    local issues_found=false
    
    # Check if .next directory is very old
    if [ -d .next ]; then
        local next_age=$(find .next -maxdepth 0 -type d -printf '%AY-%Am-%Ad %AH:%AM\n' 2>/dev/null || echo "unknown")
        echo "  • .next directory age: $next_age"
        
        # Check if it's older than 7 days
        if [ -n "$next_age" ] && [ "$next_age" != "unknown" ]; then
            local days_old=$(( ( $(date +%s) - $(date -d "$next_age" +%s) ) / 86400 ))
            if [ $days_old -gt 7 ]; then
                print_warning "  • .next directory is $days_old days old - consider clearing cache"
                issues_found=true
            fi
        fi
    fi
    
    # Check Docker build cache size
    local build_cache_size=$(docker builder du 2>/dev/null | tail -1 | awk '{print $1}' || echo "0")
    if [ "$build_cache_size" != "0" ] && [ "$build_cache_size" != "unknown" ]; then
        echo "  • Docker build cache size: $build_cache_size"
        # If cache is larger than 1GB, suggest clearing
        if [ "$build_cache_size" -gt 1073741824 ]; then
            print_warning "  • Docker build cache is large - consider clearing"
            issues_found=true
        fi
    fi
    
    if [ "$issues_found" = false ]; then
        print_success "No cache issues detected"
    fi
}

# Show cache configuration
show_cache_config() {
    print_status "Cache Configuration:"
    echo ""
    echo "Next.js Configuration:"
    echo "  • Build ID: Generated with timestamp for cache busting"
    echo "  • Static assets: 1 year cache with immutable flag"
    echo "  • API routes: No cache (no-cache, no-store, must-revalidate)"
    echo "  • HTML pages: 5 minute cache with must-revalidate"
    echo ""
    echo "Docker Configuration:"
    echo "  • Multi-stage build for optimal caching"
    echo "  • Build arguments for cache invalidation"
    echo "  • Layer optimization for faster rebuilds"
    echo ""
    echo "Database Persistence:"
    echo "  • SQLite database: Persisted via Docker volume"
    echo "  • Automatic backup before deployments"
    echo "  • Data integrity maintained between updates"
}

# Main functions
clear_all_caches() {
    print_status "Clearing all caches..."
    
    clear_next_cache
    clear_docker_cache
    
    print_success "All caches cleared successfully"
}

# Show help
help() {
    echo "Cache Management Utility for Personal Finance Dashboard"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  clear-next      - Clear Next.js build cache only"
    echo "  clear-docker    - Clear Docker cache only"
    echo "  clear-all       - Clear all caches (Next.js + Docker)"
    echo "  verify          - Verify current cache status"
    echo "  check-issues    - Check for potential cache issues"
    echo "  browser-info    - Show browser cache information"
    echo "  config          - Show cache configuration"
    echo "  help            - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 clear-all    - Clear all caches"
    echo "  $0 verify       - Check cache status"
    echo "  $0 check-issues - Look for cache problems"
    echo ""
    echo "When to clear caches:"
    echo "• After UI/UX updates that aren't showing"
    echo "• When Docker builds seem stuck"
    echo "• After dependency updates"
    echo "• When experiencing strange behavior"
}

# Main script logic
case "${1:-help}" in
    clear-next)
        clear_next_cache
        ;;
    clear-docker)
        clear_docker_cache
        ;;
    clear-all)
        clear_all_caches
        ;;
    verify)
        verify_cache_status
        ;;
    check-issues)
        check_cache_issues
        ;;
    browser-info)
        clear_browser_cache_info
        ;;
    config)
        show_cache_config
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