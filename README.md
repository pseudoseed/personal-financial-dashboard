# pseudofi

Pseudofi is a secure, unified personal finance dashboard.

A dashboard to track all your financial accounts in one place using Plaid API and Coinbase integration. Features include bank account balance tracking, cryptocurrency holdings, daily updates, and email notifications.
![image](https://github.com/user-attachments/assets/d0d8ba2c-d540-444e-a739-7f5797c4dd20)

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- A Plaid account (Development or Production)
- (Optional) Amazon SES account for email notifications

## Quick Start

### Linux Server Deployment (Recommended)

For Linux servers, use the automated setup script:

```bash
# Clone the repository
git clone <repository-url>
cd personal-finance-dashboard

# Run the Linux setup script
chmod +x scripts/setup-linux.sh
./scripts/setup-linux.sh
```

The setup script will:
- ✅ Check system requirements (Node.js, npm, etc.)
- ✅ Create necessary directories with proper permissions
- ✅ Set up environment configuration
- ✅ Install dependencies
- ✅ Initialize the database
- ✅ Generate secure secrets
- ✅ Optionally create systemd service for auto-start
- ✅ Optionally set up cron jobs for data refresh

### Validate Your Setup

After setup, verify everything is working correctly:

```bash
# Run the validation script
chmod +x scripts/validate-setup.sh
./scripts/validate-setup.sh
```

The validation script checks:
- ✅ System requirements (Node.js, npm, etc.)
- ✅ Directory permissions
- ✅ Database connectivity
- ✅ Environment configuration
- ✅ Dependencies installation
- ✅ Script permissions
- ✅ Application configuration
- ✅ Network access

### Manual Setup

If you prefer manual setup or are on a different platform:

#### 1. Plaid Setup

1. Create a [Plaid account](https://dashboard.plaid.com/signup)
2. Once logged in, go to the [Keys section](https://dashboard.plaid.com/team/keys)
3. Copy your `client_id` and the appropriate `secret` (sandbox/development/production)
4. Note: For real bank connections, you'll need Development or Production credentials

#### 2. Coinbase Setup

1. Go to [Coinbase Developer Portal](https://www.coinbase.com/settings/api)
2. Click "New OAuth2 Application"
3. Fill in the application details:
   - Name: Personal Finance Dashboard (or your preferred name)
   - Website URL: http://localhost:3000
   - Redirect URLs: http://localhost:3000/api/crypto/oauth/callback
4. Copy your `client_id` and `client_secret`
5. Note: The redirect URL must match exactly what you set in your `.env` file

#### 3. Environment Setup

1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd personal-finance-dashboard
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

4. Update `.env` with your credentials:
   ```env
   # Plaid API credentials
   PLAID_CLIENT_ID="your_client_id"
   PLAID_SECRET="your_secret"
   PLAID_ENV="development"  # or "sandbox" or "production"

   # Coinbase API credentials
   COINBASE_CLIENT_ID="your_coinbase_client_id"
   COINBASE_CLIENT_SECRET="your_coinbase_client_secret"
   COINBASE_REDIRECT_URI="http://localhost:3000/api/crypto/oauth/callback"

   # Database
   DATABASE_URL="file:./data/dev.db"

   # Next Auth (generate a secret with: openssl rand -base64 32)
   NEXTAUTH_SECRET="your_generated_secret"
   NEXTAUTH_URL="http://localhost:3000"
   ```

#### 4. Database Setup

1. Initialize the database:
   ```bash
   npx prisma db push
   ```

#### 5. Running the Application

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open [http://localhost:3000](http://localhost:3000) in your browser

## Linux Server Deployment Guide

### Automated Setup (Recommended)

The `scripts/setup-linux.sh` script handles all setup automatically:

```bash
./scripts/setup-linux.sh
```

### Manual Linux Setup

If you prefer manual setup on Linux:

#### 1. System Requirements

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs
```

#### 2. Directory Setup

```bash
# Create necessary directories
mkdir -p data logs backups
chmod 755 data logs backups

# Verify write permissions
ls -la data/
```

#### 3. Database Initialization

```bash
# Run the database initialization script
chmod +x scripts/init-db.sh
./scripts/init-db.sh
```

#### 4. Process Management

**Option A: Systemd Service**
```bash
# Create systemd service (requires sudo)
sudo tee /etc/systemd/system/personal-finance-dashboard.service << EOF
[Unit]
Description=Personal Finance Dashboard
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
Environment=NODE_ENV=production
Environment=DATABASE_URL=file:$(pwd)/data/dev.db
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable personal-finance-dashboard
sudo systemctl start personal-finance-dashboard
```

**Option B: PM2**
```bash
# Install PM2
npm install -g pm2

# Start the application
pm2 start npm --name "personal-finance-dashboard" -- start
pm2 startup
pm2 save
```

#### 5. Reverse Proxy (Nginx)

```bash
# Install nginx
sudo apt-get install nginx

# Create nginx configuration
sudo tee /etc/nginx/sites-available/personal-finance-dashboard << EOF
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable the site
sudo ln -s /etc/nginx/sites-available/personal-finance-dashboard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Troubleshooting Linux Issues

#### Permission Errors
```bash
# Check file permissions
ls -la data/dev.db
ls -la scripts/

# Fix permissions if needed
chmod 755 data/
chmod 644 data/dev.db
chmod +x scripts/*.sh
```

#### Database Connection Issues
```bash
# Check if database exists and is accessible
sqlite3 data/dev.db "SELECT COUNT(*) FROM users;"

# Reset database if corrupted
rm data/dev.db
./scripts/init-db.sh
```

#### Port Already in Use
```bash
# Check what's using port 3000
sudo netstat -tlnp | grep :3000

# Kill the process if needed
sudo kill -9 <PID>
```

#### Environment Variables
```bash
# Verify .env file exists and has correct values
cat .env | grep DATABASE_URL

# Test environment loading
source .env && echo $DATABASE_URL
```

## Daily Balance Updates (Optional)

If you want to receive daily balance updates via email, follow these additional steps:

### 1. Email Setup (Amazon SES)

Add the following to your `.env` file to enable email notifications:
   ```env
   EMAIL_HOST=email-smtp.us-east-1.amazonaws.com
   EMAIL_PORT=587
   EMAIL_USER=your_ses_smtp_username
   EMAIL_PASSWORD=your_ses_smtp_password
   EMAIL_FROM=your_verified_email@domain.com
   ```

### 2. Setting Up the Daily Update Script

1. Make the refresh script executable:
   ```bash
   chmod +x scripts/refresh-data.sh
   ```

2. Create a logs directory:
   ```bash
   mkdir logs
   ```

3. Test the script:
   ```bash
   ./scripts/refresh-data.sh
   ```

### 3. Setting Up the Cron Job

1. Open your crontab:
   ```bash
   crontab -e
   ```

2. Add the following line to run the script daily at 6 AM:
   ```bash
   0 6 * * * /full/path/to/scripts/refresh-data.sh >> /full/path/to/logs/refresh.log 2>&1
   ```
   Replace `/full/path/to` with your actual project path.

3. Save and exit the editor

4. Verify your cron job:
   ```bash
   crontab -l
   ```

### Troubleshooting

1. Check the logs for any errors:
   ```bash
   tail -f logs/refresh.log
   ```

2. Common issues:
   - `ITEM_LOGIN_REQUIRED`: You need to re-authenticate with your bank
   - `INVALID_CREDENTIALS`: Your bank credentials need updating
   - `INSTITUTION_DOWN`: The bank's systems are temporarily unavailable

## Development

### Project Structure

- `/src` - Application source code
  - `/app` - Next.js app router components
  - `/components` - Reusable React components
  - `/lib` - Utility functions and configurations
- `/scripts` - Automation scripts
- `/prisma` - Database schema and migrations

### Database Management with Prisma Studio

Prisma Studio provides a modern interface to view and edit your database data:

1. Start Prisma Studio:
   ```bash
   npx prisma studio
   ```

2. Open [http://localhost:5555](http://localhost:5555) in your browser

3. You can:
   - View all your connected bank accounts
   - See historical balance records
   - Manage Plaid connections
   - Export data as CSV
   - Filter and sort records

Note: Be cautious when manually editing data as it might affect the application's functionality.

## Docker Deployment

For containerized deployment, use the provided Docker setup:

```bash
# Build and deploy using Docker Compose
./deploy.sh deploy

# Check status
./deploy.sh status

# View logs
./deploy.sh logs

# Stop the application
./deploy.sh stop
```

The Docker setup includes:
- ✅ Proper user permissions
- ✅ Database initialization
- ✅ Health checks
- ✅ Automatic restarts
- ✅ Volume persistence

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](LICENSE)
