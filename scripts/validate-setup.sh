#!/bin/bash

# Validation script for Personal Finance Dashboard
# This script checks if the application is properly set up

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

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

# Configuration
DATA_DIR="$PROJECT_DIR/data"
LOGS_DIR="$PROJECT_DIR/logs"
BACKUPS_DIR="$PROJECT_DIR/backups"
DB_FILE="$DATA_DIR/dev.db"
ENV_FILE="$PROJECT_DIR/.env"

# Track validation results
PASSED=0
FAILED=0
WARNINGS=0

# Validation functions
validate_system() {
    print_status "Validating system requirements..."
    
    # Check Node.js
    if command -v node &> /dev/null; then
        local node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$node_version" -ge 18 ]; then
            print_success "Node.js $(node -v) ✓"
            ((PASSED++))
        else
            print_error "Node.js version 18+ required, found $(node -v)"
            ((FAILED++))
        fi
    else
        print_error "Node.js not found"
        ((FAILED++))
    fi
    
    # Check npm
    if command -v npm &> /dev/null; then
        print_success "npm $(npm -v) ✓"
        ((PASSED++))
    else
        print_error "npm not found"
        ((FAILED++))
    fi
    
    # Check npx
    if command -v npx &> /dev/null; then
        print_success "npx available ✓"
        ((PASSED++))
    else
        print_error "npx not available"
        ((FAILED++))
    fi
}

validate_directories() {
    print_status "Validating directories..."
    
    local dirs=("$DATA_DIR" "$LOGS_DIR" "$BACKUPS_DIR")
    
    for dir in "${dirs[@]}"; do
        if [ -d "$dir" ]; then
            if [ -w "$dir" ]; then
                print_success "Directory writable: $dir ✓"
                ((PASSED++))
            else
                print_error "Directory not writable: $dir"
                ((FAILED++))
            fi
        else
            print_warning "Directory missing: $dir"
            ((WARNINGS++))
        fi
    done
}

validate_database() {
    print_status "Validating database..."
    
    if [ -f "$DB_FILE" ]; then
        local db_size=$(stat -c%s "$DB_FILE" 2>/dev/null || echo "0")
        if [ "$db_size" -gt 0 ]; then
            print_success "Database file exists and has data ($db_size bytes) ✓"
            ((PASSED++))
            
            # Test database connection
            if command -v sqlite3 &> /dev/null; then
                local user_count=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
                if [ "$user_count" -gt 0 ]; then
                    print_success "Database connection verified ($user_count users) ✓"
                    ((PASSED++))
                else
                    print_warning "Database connected but no users found"
                    ((WARNINGS++))
                fi
            else
                print_warning "sqlite3 not available, skipping connection test"
                ((WARNINGS++))
            fi
        else
            print_error "Database file exists but is empty"
            ((FAILED++))
        fi
    else
        print_error "Database file not found: $DB_FILE"
        ((FAILED++))
    fi
}

validate_environment() {
    print_status "Validating environment configuration..."
    
    if [ -f "$ENV_FILE" ]; then
        print_success "Environment file exists ✓"
        ((PASSED++))
        
        # Check required variables
        local required_vars=("DATABASE_URL" "NEXTAUTH_SECRET" "NEXTAUTH_URL")
        local optional_vars=("PLAID_CLIENT_ID" "PLAID_SECRET" "COINBASE_CLIENT_ID" "COINBASE_CLIENT_SECRET")
        
        for var in "${required_vars[@]}"; do
            if grep -q "^${var}=" "$ENV_FILE"; then
                print_success "Required variable set: $var ✓"
                ((PASSED++))
            else
                print_error "Required variable missing: $var"
                ((FAILED++))
            fi
        done
        
        for var in "${optional_vars[@]}"; do
            if grep -q "^${var}=" "$ENV_FILE"; then
                print_success "Optional variable set: $var ✓"
                ((PASSED++))
            else
                print_warning "Optional variable not set: $var"
                ((WARNINGS++))
            fi
        done
        
        # Check DATABASE_URL format
        local db_url=$(grep "^DATABASE_URL=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"')
        if [[ "$db_url" == "file:./data/dev.db" ]]; then
            print_success "Database URL format correct ✓"
            ((PASSED++))
        else
            print_warning "Database URL format may be incorrect: $db_url"
            ((WARNINGS++))
        fi
    else
        print_error "Environment file not found: $ENV_FILE"
        ((FAILED++))
    fi
}

validate_dependencies() {
    print_status "Validating dependencies..."
    
    if [ -d "$PROJECT_DIR/node_modules" ]; then
        print_success "Node.js dependencies installed ✓"
        ((PASSED++))
        
        # Check if Prisma client is generated
        if [ -d "$PROJECT_DIR/node_modules/.prisma" ]; then
            print_success "Prisma client generated ✓"
            ((PASSED++))
        else
            print_warning "Prisma client not generated"
            ((WARNINGS++))
        fi
    else
        print_error "Node.js dependencies not found"
        ((FAILED++))
    fi
}

validate_scripts() {
    print_status "Validating scripts..."
    
    local scripts=("init-db.sh" "setup-linux.sh" "refresh-data.sh")
    
    for script in "${scripts[@]}"; do
        local script_path="$SCRIPT_DIR/$script"
        if [ -f "$script_path" ]; then
            if [ -x "$script_path" ]; then
                print_success "Script executable: $script ✓"
                ((PASSED++))
            else
                print_warning "Script not executable: $script"
                ((WARNINGS++))
            fi
        else
            print_warning "Script missing: $script"
            ((WARNINGS++))
        fi
    done
}

validate_application() {
    print_status "Validating application..."
    
    # Check if application can start (basic check)
    cd "$PROJECT_DIR"
    
    # Check if package.json exists
    if [ -f "package.json" ]; then
        print_success "package.json exists ✓"
        ((PASSED++))
        
        # Check if build script exists
        if grep -q '"build"' package.json; then
            print_success "Build script available ✓"
            ((PASSED++))
        else
            print_warning "Build script not found"
            ((WARNINGS++))
        fi
        
        # Check if start script exists
        if grep -q '"start"' package.json; then
            print_success "Start script available ✓"
            ((PASSED++))
        else
            print_warning "Start script not found"
            ((WARNINGS++))
        fi
    else
        print_error "package.json not found"
        ((FAILED++))
    fi
}

validate_network() {
    print_status "Validating network access..."
    
    # Check if port 3000 is available
    if command -v netstat &> /dev/null; then
        if ! netstat -tlnp 2>/dev/null | grep -q ":3000 "; then
            print_success "Port 3000 available ✓"
            ((PASSED++))
        else
            print_warning "Port 3000 already in use"
            ((WARNINGS++))
        fi
    else
        print_warning "netstat not available, skipping port check"
        ((WARNINGS++))
    fi
    
    # Check internet connectivity
    if command -v curl &> /dev/null; then
        if curl -s --max-time 5 https://www.google.com > /dev/null; then
            print_success "Internet connectivity available ✓"
            ((PASSED++))
        else
            print_warning "Internet connectivity test failed"
            ((WARNINGS++))
        fi
    else
        print_warning "curl not available, skipping connectivity test"
        ((WARNINGS++))
    fi
}

# Show summary
show_summary() {
    echo
    echo "=========================================="
    echo "           VALIDATION SUMMARY"
    echo "=========================================="
    echo "✅ Passed: $PASSED"
    echo "❌ Failed: $FAILED"
    echo "⚠️  Warnings: $WARNINGS"
    echo "=========================================="
    
    if [ $FAILED -eq 0 ]; then
        if [ $WARNINGS -eq 0 ]; then
            print_success "All validations passed! Your setup is ready."
        else
            print_success "Setup is functional with some warnings."
        fi
    else
        print_error "Setup has issues that need to be resolved."
        echo
        print_status "Recommended actions:"
        echo "1. Run: ./scripts/setup-linux.sh (for Linux servers)"
        echo "2. Check the error messages above"
        echo "3. Review the README.md for setup instructions"
    fi
    
    echo
    print_status "Next steps:"
    echo "1. Edit .env file with your API credentials"
    echo "2. Start the application: npm run dev"
    echo "3. Access: http://localhost:3000"
}

# Main execution
main() {
    echo "Personal Finance Dashboard - Setup Validation"
    echo "============================================="
    echo "Project directory: $PROJECT_DIR"
    echo "Validation started at: $(date)"
    echo
    
    validate_system
    validate_directories
    validate_database
    validate_environment
    validate_dependencies
    validate_scripts
    validate_application
    validate_network
    
    show_summary
}

# Run main function
main "$@" 