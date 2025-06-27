#!/bin/bash

# Linux Server Setup Script for Personal Finance Dashboard
# This script sets up the application for deployment on Linux servers

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

# Check if running as root
check_root() {
    if [ "$EUID" -eq 0 ]; then
        print_warning "Running as root. This is not recommended for security reasons."
        print_warning "Consider running as a regular user with sudo privileges."
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Check system requirements
check_requirements() {
    print_status "Checking system requirements..."
    
    # Check OS
    if [[ "$OSTYPE" != "linux-gnu"* ]]; then
        print_warning "This script is designed for Linux. Current OS: $OSTYPE"
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        print_status "Please install Node.js v18 or higher:"
        print_status "  Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
        print_status "  CentOS/RHEL: curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - && sudo yum install -y nodejs"
        exit 1
    fi
    
    local node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$node_version" -lt 18 ]; then
        print_error "Node.js version 18 or higher is required. Current version: $(node -v)"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    
    # Check git (optional but recommended)
    if ! command -v git &> /dev/null; then
        print_warning "git is not installed (optional but recommended for updates)"
    fi
    
    # Check curl
    if ! command -v curl &> /dev/null; then
        print_warning "curl is not installed (required for some features)"
    fi
    
    print_success "System requirements check complete"
}

# Setup directories with proper permissions
setup_directories() {
    print_status "Setting up directories..."
    
    # Create necessary directories
    local dirs=("$DATA_DIR" "$LOGS_DIR" "$BACKUPS_DIR")
    
    for dir in "${dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            print_status "Creating directory: $dir"
            mkdir -p "$dir"
        fi
        
        # Set permissions (755 for directories)
        chmod 755 "$dir"
        
        # Verify write access
        if [ ! -w "$dir" ]; then
            print_error "Directory is not writable: $dir"
            print_error "Please check permissions and try again"
            exit 1
        fi
    done
    
    print_success "Directory setup complete"
}

# Setup environment file
setup_environment() {
    print_status "Setting up environment configuration..."
    
    local env_file="$PROJECT_DIR/.env"
    
    if [ ! -f "$env_file" ]; then
        if [ -f "$PROJECT_DIR/env.example" ]; then
            print_status "Creating .env file from template..."
            cp "$PROJECT_DIR/env.example" "$env_file"
            print_warning "Please edit .env file with your actual configuration values"
            print_warning "Required variables: PLAID_CLIENT_ID, PLAID_SECRET, COINBASE_CLIENT_ID, COINBASE_CLIENT_SECRET"
        else
            print_error "No .env file or env.example template found"
            exit 1
        fi
    else
        print_status ".env file already exists"
    fi
    
    # Ensure .env has correct database URL
    if grep -q "DATABASE_URL=" "$env_file"; then
        # Update existing DATABASE_URL
        sed -i.bak 's|DATABASE_URL=.*|DATABASE_URL="file:./data/dev.db"|' "$env_file"
    else
        # Add DATABASE_URL if not present
        echo 'DATABASE_URL="file:./data/dev.db"' >> "$env_file"
    fi
    
    print_success "Environment setup complete"
}

# Install dependencies
install_dependencies() {
    print_status "Installing Node.js dependencies..."
    
    cd "$PROJECT_DIR"
    
    if [ -f "package-lock.json" ]; then
        npm ci --legacy-peer-deps
    else
        npm install --legacy-peer-deps
    fi
    
    print_success "Dependencies installed"
}

# Initialize database
initialize_database() {
    print_status "Initializing database..."
    
    cd "$PROJECT_DIR"
    
    # Run the database initialization script
    if [ -f "scripts/init-db.sh" ]; then
        chmod +x scripts/init-db.sh
        ./scripts/init-db.sh
    else
        print_error "Database initialization script not found"
        exit 1
    fi
    
    print_success "Database initialization complete"
}

# Setup systemd service (optional)
setup_systemd() {
    print_status "Setting up systemd service (optional)..."
    
    read -p "Create systemd service for auto-start? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Skipping systemd service setup"
        return
    fi
    
    local service_name="personal-finance-dashboard"
    local service_file="/etc/systemd/system/$service_name.service"
    local user=$(whoami)
    
    if [ "$EUID" -ne 0 ]; then
        print_warning "Systemd service creation requires sudo privileges"
        print_status "You can create the service manually later"
        return
    fi
    
    cat > "$service_file" << EOF
[Unit]
Description=Personal Finance Dashboard
After=network.target

[Service]
Type=simple
User=$user
WorkingDirectory=$PROJECT_DIR
Environment=NODE_ENV=production
Environment=DATABASE_URL=file:$DB_FILE
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable "$service_name"
    
    print_success "Systemd service created: $service_name"
    print_status "Start with: sudo systemctl start $service_name"
    print_status "Check status with: sudo systemctl status $service_name"
}

# Setup cron job for data refresh (optional)
setup_cron() {
    print_status "Setting up cron job for data refresh (optional)..."
    
    read -p "Create cron job for daily data refresh? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Skipping cron job setup"
        return
    fi
    
    local refresh_script="$PROJECT_DIR/scripts/refresh-data.sh"
    
    if [ ! -f "$refresh_script" ]; then
        print_warning "Refresh script not found: $refresh_script"
        return
    fi
    
    chmod +x "$refresh_script"
    
    # Create cron entry
    local cron_entry="0 6 * * * $refresh_script >> $LOGS_DIR/refresh.log 2>&1"
    
    print_status "Adding cron job for daily refresh at 6 AM..."
    print_status "Cron entry: $cron_entry"
    
    # Add to current user's crontab
    (crontab -l 2>/dev/null; echo "$cron_entry") | crontab -
    
    print_success "Cron job created"
    print_status "View cron jobs with: crontab -l"
}

# Generate secrets
generate_secrets() {
    print_status "Generating application secrets..."
    
    cd "$PROJECT_DIR"
    
    # Generate NEXTAUTH_SECRET if not present
    local env_file="$PROJECT_DIR/.env"
    if ! grep -q "NEXTAUTH_SECRET=" "$env_file"; then
        local secret=$(openssl rand -base64 32)
        echo "NEXTAUTH_SECRET=\"$secret\"" >> "$env_file"
        print_success "Generated NEXTAUTH_SECRET"
    else
        print_status "NEXTAUTH_SECRET already exists"
    fi
    
    print_success "Secrets generation complete"
}

# Final validation
validate_setup() {
    print_status "Validating setup..."
    
    # Check if database exists and is accessible
    if [ -f "$DB_FILE" ]; then
        local db_size=$(stat -c%s "$DB_FILE" 2>/dev/null || echo "0")
        if [ "$db_size" -gt 0 ]; then
            print_success "Database file exists and has data ($db_size bytes)"
        else
            print_warning "Database file exists but is empty"
        fi
    else
        print_error "Database file not found: $DB_FILE"
        exit 1
    fi
    
    # Check if .env file exists
    if [ -f "$PROJECT_DIR/.env" ]; then
        print_success "Environment file exists"
    else
        print_error "Environment file not found"
        exit 1
    fi
    
    # Check if node_modules exists
    if [ -d "$PROJECT_DIR/node_modules" ]; then
        print_success "Node.js dependencies installed"
    else
        print_error "Node.js dependencies not found"
        exit 1
    fi
    
    print_success "Setup validation complete"
}

# Show next steps
show_next_steps() {
    echo
    print_success "Setup completed successfully!"
    echo
    print_status "Next steps:"
    echo "1. Edit .env file with your API credentials:"
    echo "   - PLAID_CLIENT_ID and PLAID_SECRET"
    echo "   - COINBASE_CLIENT_ID and COINBASE_CLIENT_SECRET"
    echo "   - Email settings (optional)"
    echo
    echo "2. Start the application:"
    echo "   cd $PROJECT_DIR"
    echo "   npm run dev          # Development mode"
    echo "   npm start            # Production mode"
    echo
    echo "3. Access the dashboard:"
    echo "   http://localhost:3000"
    echo
    echo "4. Connect your financial accounts:"
    echo "   - Use 'Connect Bank Account' for Plaid integration"
    echo "   - Use 'Connect Coinbase' for cryptocurrency"
    echo
    print_status "For production deployment, consider:"
    echo "- Using a reverse proxy (nginx)"
    echo "- Setting up SSL certificates"
    echo "- Using PM2 or systemd for process management"
    echo "- Setting up regular backups"
}

# Main execution
main() {
    print_status "Starting Linux server setup for Personal Finance Dashboard..."
    print_status "Project directory: $PROJECT_DIR"
    
    check_root
    check_requirements
    setup_directories
    setup_environment
    install_dependencies
    generate_secrets
    initialize_database
    setup_systemd
    setup_cron
    validate_setup
    show_next_steps
    
    print_success "Linux server setup completed successfully!"
}

# Run main function
main "$@" 