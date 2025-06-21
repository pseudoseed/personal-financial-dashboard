# Docker Deployment Guide

This guide explains how to deploy the Personal Financial Dashboard using Docker and Docker Compose.

## Prerequisites

- Docker installed on your server
- Docker Compose installed
- Git (for cloning the repository)

## Quick Start

1. **Clone the repository** (if not already done):
   ```bash
   git clone https://github.com/pseudoseed/personal-financial-dashboard.git
   cd personal-financial-dashboard
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

3. **Deploy the application**:
   ```bash
   ./deploy.sh deploy
   ```

4. **Access the dashboard**:
   Open your browser and go to `http://your-server-ip:3000`

## Deployment Script

The `deploy.sh` script provides easy management commands:

```bash
# Deploy the application
./deploy.sh deploy

# Stop the application
./deploy.sh stop

# Restart the application
./deploy.sh restart

# Update to latest version
./deploy.sh update

# View logs
./deploy.sh logs

# View cron job logs
./deploy.sh cron_logs

# Check status
./deploy.sh status

# Manually run refresh
./deploy.sh refresh

# Create default user manually (if needed)
./deploy.sh create_user

# Show cron schedule
./deploy.sh cron_schedule

# Show help
./deploy.sh help
```

## Automated Transaction Syncing

The Docker setup includes automated cron jobs that run daily at 6:00 AM to:

- **Refresh account balances** from all connected financial institutions
- **Sync new transactions** from Plaid and Coinbase
- **Update liability information** for credit accounts and loans
- **Send email notifications** (if configured) with balance changes

### Cron Job Features

- **Automatic scheduling**: Runs daily at 6:00 AM UTC
- **Comprehensive logging**: All activity logged to `logs/cron.log`
- **Error handling**: Failed syncs are logged with details
- **Email notifications**: Optional daily summary emails
- **Manual execution**: Can be run manually anytime

### Monitoring Cron Jobs

```bash
# View cron logs
./deploy.sh cron_logs

# Check last run time
./deploy.sh status

# Manually trigger a refresh
./deploy.sh refresh
```

### Customizing Cron Schedule

To change the sync frequency, edit the Dockerfile and rebuild:

1. **Edit the cron schedule** in `Dockerfile` (line with `0 6 * * *`)
2. **Rebuild the container**:
   ```bash
   ./deploy.sh update
   ```

**Common cron patterns**:
- `0 6 * * *` - Daily at 6 AM (current)
- `0 */6 * * *` - Every 6 hours
- `0 6,18 * * *` - Twice daily at 6 AM and 6 PM
- `0 6 * * 1-5` - Weekdays only at 6 AM

## Manual Docker Commands

If you prefer to use Docker commands directly:

```bash
# Build and start
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Restart
docker-compose restart

# Execute refresh manually
docker-compose exec financial-dashboard /app/scripts/refresh-data-docker.sh
```

## Configuration

### Database Initialization

The application automatically initializes the database on startup:

1. **Prisma migrations** are applied to set up the database schema
2. **Default user** is created with ID "default" and email "default@example.com"
3. **Database file** is created at `/app/data/dev.db` inside the container

If you encounter foreign key constraint errors, you can manually create the default user:

```bash
./deploy.sh create_user
```

### Environment Variables

The application uses the following environment variables (configured in `.env`):

- `DATABASE_URL` - SQLite database path (automatically set to `/app/data/dev.db` in container)
- `PLAID_CLIENT_ID` - Your Plaid client ID
- `PLAID_SECRET` - Your Plaid secret
- `PLAID_ENV` - Plaid environment (sandbox/development/production)
- `COINBASE_CLIENT_ID` - Your Coinbase client ID
- `COINBASE_CLIENT_SECRET` - Your Coinbase client secret
- `COINBASE_REDIRECT_URI` - Coinbase OAuth redirect URI
- `OPENAI_API_KEY` - OpenAI API key for transaction categorization
- Email configuration (SMTP settings) for notifications

### Port Configuration

The application runs on port 3000 by default. To change this, modify the `docker-compose.yml` file:

```yaml
ports:
  - "YOUR_PORT:3000"
```

### Data Persistence

The application data is stored in:
- `./data/` - SQLite database and other persistent data
- `./logs/` - Application logs and cron job logs
- `./backups/` - Database backups (created automatically)

These directories are mounted as volumes and persist across container restarts.

## Health Monitoring

The container includes a health check that monitors:
- Application availability
- Database connectivity
- API endpoint responsiveness

You can check the health status with:
```bash
docker-compose exec financial-dashboard curl http://localhost:3000/api/health
```

## Updates

To update the application:

1. **Pull latest changes**:
   ```bash
   git pull
   ```

2. **Rebuild and restart**:
   ```bash
   ./deploy.sh update
   ```

Or manually:
```bash
docker-compose down
docker-compose up -d --build
```

## Backup and Restore

### Backup Database

```bash
./deploy.sh backup
```

This creates a timestamped backup in the `backups/` directory.

### Restore Database

```bash
# Stop the application
./deploy.sh stop

# Copy your backup to the data directory
cp backups/your_backup_file.db data/dev.db

# Start the application
./deploy.sh deploy
```

## Troubleshooting

### Common Issues

1. **Port already in use**:
   ```bash
   # Check what's using port 3000
   lsof -i :3000
   
   # Change port in docker-compose.yml
   ```

2. **Permission issues**:
   ```bash
   # Fix data directory permissions
   sudo chown -R $USER:$USER data/
   ```

3. **Container won't start**:
   ```bash
   # Check logs
   ./deploy.sh logs
   
   # Check container status
   docker-compose ps
   ```

4. **Database connection issues**:
   ```bash
   # Check if database file exists
   ls -la data/
   
   # Verify environment variables
   docker-compose exec financial-dashboard env | grep DATABASE
   ```

5. **Cron job not running**:
   ```bash
   # Check cron logs
   ./deploy.sh cron_logs
   
   # Manually test refresh
   ./deploy.sh refresh
   
   # Check cron service status
   docker-compose exec financial-dashboard ps aux | grep cron
   ```

### Logs

View application logs:
```bash
./deploy.sh logs
```

View cron job logs:
```bash
./deploy.sh cron_logs
```

Or directly:
```bash
docker-compose logs -f financial-dashboard
tail -f logs/cron.log
```

### Container Shell Access

Access the container shell for debugging:
```bash
docker-compose exec financial-dashboard sh
```

## Security Considerations

1. **Environment Variables**: Never commit your `.env` file to version control
2. **Database**: The SQLite database contains sensitive financial data - ensure proper backups
3. **Network**: Consider using a reverse proxy (nginx) for production deployments
4. **Updates**: Regularly update the application and dependencies
5. **Cron Jobs**: Monitor cron logs for any sync failures or errors

## Production Recommendations

For production deployment, consider:

1. **Reverse Proxy**: Use nginx or Traefik for SSL termination
2. **SSL Certificate**: Set up HTTPS with Let's Encrypt
3. **Monitoring**: Add monitoring with Prometheus/Grafana
4. **Backup Strategy**: Automated database backups
5. **Resource Limits**: Set memory and CPU limits in docker-compose.yml
6. **Cron Monitoring**: Set up alerts for cron job failures

Example nginx configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
``` 