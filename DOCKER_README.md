# Personal Financial Dashboard - Docker Deployment Guide

This guide explains how to deploy the Personal Financial Dashboard using Docker and Docker Compose for version 1.0.

## Prerequisites

- Docker installed on your server (version 20.10 or higher)
- Docker Compose installed (version 2.0 or higher)
- Git (for cloning the repository)
- At least 1GB of available RAM
- 2GB of available disk space

## Quick Start

1. **Clone the repository** (if not already done):
   ```bash
   git clone https://github.com/pseudoseed/personal-financial-dashboard.git
   cd personal-financial-dashboard
   ```

2. **Set up environment variables**:
   ```bash
   cp env.example .env
   # Edit .env with your API keys and configuration
   ```

3. **Deploy the application**:
   ```bash
   ./deploy.sh deploy
   ```

4. **Access the dashboard**:
   Open your browser and go to `http://your-server-ip:3000`

## Docker Compose Compatibility

The deployment script automatically detects and uses the appropriate Docker Compose command:
- **Docker Compose v2** (preferred): `docker compose`
- **Docker Compose v1** (fallback): `docker-compose`

This ensures compatibility across different Docker installations and versions.

## Environment Configuration

The application requires several environment variables to function properly. Copy `env.example` to `.env` and configure:

### Required Variables
- `PLAID_CLIENT_ID` - Your Plaid client ID
- `PLAID_SECRET` - Your Plaid secret key
- `PLAID_ENV` - Plaid environment (sandbox/development/production)
- `COINBASE_CLIENT_ID` - Your Coinbase client ID
- `COINBASE_CLIENT_SECRET` - Your Coinbase client secret
- `NEXTAUTH_SECRET` - A secure random string for session encryption

### Optional Variables
- `OPENAI_API_KEY` - For AI-powered transaction categorization
- Email configuration for notifications
- Custom domain settings for production

## Deployment Script

The `deploy.sh` script provides comprehensive management commands:

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

# Check status
./deploy.sh status

# Create database backup
./deploy.sh backup

# Manually run refresh
./deploy.sh refresh

# Show refresh configuration
./deploy.sh refresh_info

# Show help
./deploy.sh help
```

## Smart Refresh System

The application uses an intelligent refresh system to minimize API costs:

- **Auto-refresh**: Data refreshes automatically when stale (>6 hours old)
- **Manual refresh**: Limited to 3 times per day per user
- **Smart caching**: 2-24 hour TTL based on account activity
- **Batch processing**: Processes accounts by institution to reduce API calls
- **Rate limiting**: Prevents excessive API usage

### Cost Optimization Features
- **Smart caching** reduces redundant requests by 70-90%
- **Batch processing** by institution minimizes API calls
- **Rate limiting** prevents abuse and excessive costs
- **Intelligent TTL** based on account activity patterns

## Database Management

### Automatic Initialization
The application automatically initializes the database on startup:
- Applies all Prisma migrations
- Creates default user (ID: "default")
- Sets up database schema and indexes
- Verifies database connectivity

### Backup Strategy
```bash
# Create manual backup
./deploy.sh backup

# Backup files are stored in ./backups/ with timestamps
```

### Database Location
- **Container**: `/app/data/dev.db`
- **Host**: `./data/dev.db`
- **Backups**: `./backups/`

## Health Monitoring

The application includes comprehensive health monitoring:

### Health Check Endpoint
```bash
curl http://localhost:3000/api/health
```

### Health Check Response
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "database": {
    "connected": true,
    "userExists": true,
    "accounts": 5,
    "transactions": 1250
  },
  "version": "1.0.0",
  "environment": "production"
}
```

### Docker Health Check
The container includes automatic health checks:
- Checks every 30 seconds
- 10-second timeout
- 3 retries before marking unhealthy
- 60-second startup grace period

## Manual Docker Commands

If you prefer to use Docker commands directly:

### Docker Compose v2 (Recommended)
```bash
# Build and start
docker compose up -d --build

# View logs
docker compose logs -f

# Stop
docker compose down

# Restart
docker compose restart

# Check status
docker compose ps

# Execute commands in container
docker compose exec financial-dashboard bash
```

### Docker Compose v1 (Legacy)
```bash
# Build and start
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Restart
docker-compose restart

# Check status
docker-compose ps

# Execute commands in container
docker-compose exec financial-dashboard bash
```

## Configuration

### Port Configuration
The application runs on port 3000 by default. To change this, modify `docker-compose.yml`:

```yaml
ports:
  - "YOUR_PORT:3000"
```

### Resource Limits
The container is configured with resource limits:
- **Memory**: 1GB limit, 512MB reservation
- **CPU**: No explicit limits (uses host defaults)

### Data Persistence
The following directories are mounted as volumes:
- `./data/` - SQLite database and persistent data
- `./logs/` - Application logs
- `./backups/` - Database backups

These directories persist across container restarts and updates.

## Troubleshooting

### Common Issues

1. **Foreign Key Constraint Errors**
   ```bash
   # Recreate the database
   docker-compose down
   rm -rf data/
   ./deploy.sh deploy
   ```

2. **Environment Variables Missing**
   ```bash
   # Check if .env file exists
   ls -la .env
   
   # Create from template if missing
   cp env.example .env
   # Edit .env with your values
   ```

3. **Container Won't Start**
   ```bash
   # Check logs
   ./deploy.sh logs
   
   # Check Docker status
   docker info
   ```

4. **Health Check Failing**
   ```bash
   # Check application logs
   ./deploy.sh logs
   
   # Test health endpoint manually
   curl http://localhost:3000/api/health
   ```

### Log Locations
- **Application logs**: `./logs/` directory
- **Docker logs**: `docker-compose logs`
- **Container logs**: `docker logs financial-dashboard`

## Production Deployment

### Security Considerations
- Use strong `NEXTAUTH_SECRET`
- Configure HTTPS in production
- Use production Plaid environment
- Secure your API keys
- Regular database backups

### Performance Optimization
- Monitor resource usage: `./deploy.sh status`
- Adjust memory limits in `docker-compose.yml` if needed
- Consider using external database for high-traffic deployments

### Monitoring
- Health check endpoint: `/api/health`
- Resource monitoring: `docker stats`
- Log monitoring: `./deploy.sh logs`

## Updates and Maintenance

### Updating the Application
```bash
# Update to latest version
./deploy.sh update

# This will:
# 1. Pull latest changes from git
# 2. Rebuild the Docker image
# 3. Restart the application
# 4. Preserve all data
```

### Database Migrations
Database migrations are applied automatically on startup. If you need to run them manually:

```bash
docker-compose exec financial-dashboard npx prisma migrate deploy
```

### Backup Before Updates
```bash
# Always backup before major updates
./deploy.sh backup
./deploy.sh update
```

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review application logs: `./deploy.sh logs`
3. Check health status: `./deploy.sh status`
4. Verify environment configuration
5. Test with a fresh deployment if needed

## Version Information

- **Current Version**: 1.0.0
- **Node.js**: 20.x
- **Next.js**: 15.1.6
- **Database**: SQLite with Prisma
- **Container**: Alpine Linux 