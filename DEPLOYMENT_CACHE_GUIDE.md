# Deployment Cache Management Guide

This guide explains how to use the enhanced deployment system with cache busting, data persistence, and verification features for the Personal Finance Dashboard.

## Overview

The deployment system now includes comprehensive cache management to ensure reliable updates while maintaining data persistence between deployments.

## Cache Layers

### 1. Docker Layer Cache
- **What it is**: Docker caches build layers for faster rebuilds
- **When to clear**: When Docker builds seem stuck or after major changes
- **How to clear**: Use `--force-rebuild` flag or `clear-cache` command

### 2. Next.js Build Cache
- **What it is**: Next.js caches build artifacts in `.next` directory
- **When to clear**: After UI/UX updates that aren't showing
- **How to clear**: Use `--clear-cache` flag or `clear-cache` command

### 3. Browser Cache
- **What it is**: Browser caches static assets and API responses
- **When to clear**: When UI changes aren't visible in browser
- **How to clear**: Hard refresh (Ctrl+Shift+R) or clear browser data

### 4. Database Cache
- **What it is**: SQLite query caching and file system caching
- **When to clear**: Rarely needed, handled automatically
- **How to clear**: Restart container or clear system cache

## Deployment Commands

### Basic Deployment
```bash
# Normal deployment with caching
./deploy.sh deploy

# Deploy with cache clearing (recommended for UI updates)
./deploy.sh deploy --clear-cache

# Force rebuild without any cache (for major changes)
./deploy.sh deploy --force-rebuild
```

### Cache Management
```bash
# Clear all caches
./deploy.sh clear-cache

# Use cache management utility for more options
./scripts/cache-manager.sh clear-all
./scripts/cache-manager.sh verify
./scripts/cache-manager.sh check-issues
```

### Verification
```bash
# Run full deployment verification
./deploy.sh verify

# Use verification script directly
./scripts/verify-deployment.sh full
./scripts/verify-deployment.sh quick
```

## When to Use Different Deployment Options

### Normal Deployment (`./deploy.sh deploy`)
- **Use for**: Regular updates, bug fixes, minor changes
- **Cache behavior**: Uses Docker layer caching for speed
- **Data safety**: Automatic backup before deployment
- **Best for**: Most deployments

### Cache Clearing Deployment (`./deploy.sh deploy --clear-cache`)
- **Use for**: UI/UX updates, styling changes, component updates
- **Cache behavior**: Clears Next.js cache, uses Docker caching
- **Data safety**: Automatic backup before deployment
- **Best for**: Frontend changes that might be cached

### Force Rebuild Deployment (`./deploy.sh deploy --force-rebuild`)
- **Use for**: Major changes, dependency updates, Docker issues
- **Cache behavior**: Clears all Docker cache, rebuilds everything
- **Data safety**: Automatic backup before deployment
- **Best for**: When experiencing strange behavior or major updates

## Data Persistence

### Database Persistence
- **SQLite database**: Stored in Docker volume `dashboard_data`
- **Automatic backup**: Created before every deployment
- **Location**: `backups/pre-deploy-backup-YYYYMMDD-HHMMSS.db`
- **Verification**: Use `./deploy.sh verify` to check data integrity

### Volume Mounts
- **Data volume**: `/app/data` - Database and application data
- **Logs volume**: `/app/logs` - Application logs
- **Backups volume**: `/app/backups` - Database backups

### Backup Strategy
1. **Pre-deployment backup**: Automatic before each deployment
2. **Manual backup**: `./deploy.sh backup`
3. **Backup verification**: Check backup file size and integrity

## Verification Process

### Quick Health Check
```bash
./scripts/verify-deployment.sh quick
```
Checks:
- Docker is running
- Container is running
- Application health endpoint responds

### Full Verification
```bash
./scripts/verify-deployment.sh full
```
Checks:
- Container status and health
- Application endpoint availability
- Database persistence and integrity
- Volume mount verification
- Resource usage monitoring
- Error log analysis

### Database Verification
```bash
./scripts/verify-deployment.sh database
```
Checks:
- Database file exists and is accessible
- Critical tables exist
- Data integrity (record counts)
- Database connection

## Troubleshooting

### UI Changes Not Showing
1. **Clear browser cache**: Hard refresh (Ctrl+Shift+R)
2. **Clear Next.js cache**: `./deploy.sh deploy --clear-cache`
3. **Force rebuild**: `./deploy.sh deploy --force-rebuild`

### Docker Build Issues
1. **Clear Docker cache**: `./deploy.sh clear-cache`
2. **Force rebuild**: `./deploy.sh deploy --force-rebuild`
3. **Check Docker logs**: `./deploy.sh logs`

### Database Issues
1. **Check data persistence**: `./scripts/verify-deployment.sh database`
2. **Restore from backup**: Copy backup file to data directory
3. **Check volume mounts**: `./scripts/verify-deployment.sh volumes`

### Application Not Starting
1. **Check container status**: `./deploy.sh status`
2. **Check logs**: `./deploy.sh logs`
3. **Run verification**: `./deploy.sh verify`

## Best Practices

### Before Deployment
1. **Check current status**: `./deploy.sh status`
2. **Create manual backup**: `./deploy.sh backup` (optional, automatic backup happens)
3. **Clear caches if needed**: `./deploy.sh clear-cache`

### During Deployment
1. **Monitor logs**: `./deploy.sh logs` (in another terminal)
2. **Wait for completion**: Don't interrupt the process
3. **Check for errors**: Watch for error messages

### After Deployment
1. **Run verification**: `./deploy.sh verify`
2. **Test functionality**: Check key features work
3. **Monitor performance**: Check resource usage

### Regular Maintenance
1. **Weekly verification**: `./deploy.sh verify`
2. **Monthly cache check**: `./scripts/cache-manager.sh check-issues`
3. **Quarterly backup test**: Verify backup restoration process

## Cache Configuration

### Next.js Cache Headers
- **Static assets**: 1 year cache with immutable flag
- **API routes**: No cache (no-cache, no-store, must-revalidate)
- **HTML pages**: 5 minute cache with must-revalidate

### Docker Build Optimization
- **Multi-stage build**: Optimized for layer caching
- **Build arguments**: Cache invalidation with timestamps
- **Layer ordering**: Dependencies first, source code last

### Database Optimization
- **SQLite configuration**: Optimized for read/write performance
- **Connection pooling**: Efficient database connections
- **Query optimization**: Indexed queries for better performance

## Monitoring and Alerts

### Health Monitoring
- **Container health check**: Every 30 seconds
- **Application health endpoint**: `/api/health`
- **Resource monitoring**: CPU and memory usage

### Error Detection
- **Log monitoring**: Error pattern detection
- **Health check failures**: Automatic retry logic
- **Resource thresholds**: Memory and CPU limits

### Performance Metrics
- **Build times**: Tracked for optimization
- **Startup times**: Application readiness monitoring
- **Resource usage**: Memory and CPU consumption

## Security Considerations

### Data Protection
- **Database encryption**: SQLite encryption (if configured)
- **Volume security**: Docker volume isolation
- **Backup encryption**: Secure backup storage

### Access Control
- **Container isolation**: Non-root user execution
- **Network security**: Internal Docker network
- **API security**: Proper authentication and authorization

## Conclusion

The enhanced deployment system provides reliable cache management, data persistence, and comprehensive verification tools. By following these guidelines, you can ensure smooth deployments while maintaining data integrity and application performance.

For additional help:
- **Cache issues**: Use `./scripts/cache-manager.sh help`
- **Deployment issues**: Use `./deploy.sh help`
- **Verification issues**: Use `./scripts/verify-deployment.sh help` 