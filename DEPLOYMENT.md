# Production Deployment Guide

This guide covers deploying the SUT Court Queue system to production.

## Prerequisites

- Docker and Docker Compose installed
- SSL certificates (for HTTPS)
- Domain name configured
- Environment variables configured

## Quick Start

### 1. Environment Setup

Copy the production environment files and update them with your values:

```bash
cp server/.env.production server/.env.production.local
cp client/.env.production client/.env.production.local
```

Update the following critical values:
- `JWT_SECRET`: Use a secure 32+ character secret
- `ADMIN_PASSWORD`: Set a strong admin password
- `DATABASE_URL`: Configure your PostgreSQL connection
- Domain names in nginx.conf and environment files

### 2. SSL Certificates

Place your SSL certificates in the `ssl/` directory:
- `ssl/cert.pem` - SSL certificate
- `ssl/key.pem` - Private key

For development/testing, you can generate self-signed certificates:
```bash
mkdir ssl
openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes
```

### 3. Deploy

#### Using PowerShell (Windows):
```powershell
.\scripts\deploy.ps1 -JwtSecret "your-super-secure-jwt-secret-32-chars" -AdminPassword "your-secure-admin-password"
```

#### Using Bash (Linux/Mac):
```bash
export JWT_SECRET="your-super-secure-jwt-secret-32-chars"
export ADMIN_PASSWORD="your-secure-admin-password"
./scripts/deploy.sh
```

## Manual Deployment

### 1. Build the Application

```bash
# Install dependencies
npm run install:all

# Build for production
npm run build:prod
```

### 2. Database Setup

```bash
# Run migrations
cd server
npm run migrate
```

### 3. Start Services

```bash
# Using Docker Compose
docker-compose -f docker-compose.prod.yml up -d

# Or manually
npm run start:prod
```

## Configuration

### Environment Variables

#### Server (.env.production)
- `NODE_ENV=production`
- `PORT=5000`
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secure JWT secret (32+ characters)
- `ADMIN_PASSWORD`: Admin login password
- `CLIENT_URL`: Frontend domain
- `LOG_LEVEL=info`

#### Client (.env.production)
- `VITE_API_URL`: Backend API URL
- `VITE_SOCKET_URL`: WebSocket server URL

### Database

The system supports both SQLite (development) and PostgreSQL (production):

#### PostgreSQL (Recommended)
```
DATABASE_URL=postgresql://username:password@localhost:5432/sut_court_queue
```

#### SQLite (Simple deployment)
```
DATABASE_URL=./production.sqlite
```

## Monitoring

### Health Checks

The application includes built-in health checks:

```bash
# Check application health
curl https://your-domain.com/health

# Or using the health check script
npm run health-check
```

### Logs

Logs are written to:
- Console (structured JSON in production)
- File: `./logs/app.log` (if LOG_FILE is set)

View logs:
```bash
# Docker logs
docker-compose -f docker-compose.prod.yml logs -f app

# File logs
tail -f logs/app.log
```

### Metrics

The monitoring service tracks:
- Uptime
- Memory usage
- Active connections
- Request count
- Error count

Access metrics via the admin dashboard or health check endpoint.

## Security

### SSL/TLS
- Use valid SSL certificates
- Configure HTTPS redirects
- Set security headers

### Authentication
- Use strong JWT secrets
- Set secure admin passwords
- Enable rate limiting

### Network Security
- Configure firewall rules
- Use reverse proxy (nginx)
- Enable CORS properly

## Scaling

### Horizontal Scaling
- Use load balancer
- Configure sticky sessions for WebSocket
- Use Redis for session storage

### Database Scaling
- Use connection pooling
- Consider read replicas
- Monitor query performance

## Backup

### Database Backup
```bash
# PostgreSQL
pg_dump sut_court_queue > backup.sql

# SQLite
cp database.sqlite backup.sqlite
```

### Application Backup
- Source code (Git repository)
- Environment configuration
- SSL certificates
- Log files

## Troubleshooting

### Common Issues

1. **Health check fails**
   - Check database connection
   - Verify environment variables
   - Check memory usage

2. **WebSocket connection issues**
   - Verify nginx configuration
   - Check CORS settings
   - Ensure sticky sessions

3. **Database migration errors**
   - Check database permissions
   - Verify connection string
   - Run migrations manually

### Debug Commands

```bash
# Check service status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs app

# Execute commands in container
docker-compose -f docker-compose.prod.yml exec app sh

# Test database connection
docker-compose -f docker-compose.prod.yml exec db psql -U postgres -d sut_court_queue
```

## Performance Optimization

### Frontend
- Static asset caching (nginx)
- Gzip compression
- CDN for static files

### Backend
- Database query optimization
- Connection pooling
- Rate limiting

### Infrastructure
- Use SSD storage
- Adequate RAM (minimum 1GB)
- Monitor CPU usage

## Updates

### Application Updates
1. Pull latest code
2. Run build process
3. Update database schema
4. Restart services
5. Verify health checks

### Zero-downtime Updates
1. Use blue-green deployment
2. Health check before switching
3. Rollback plan ready

## Support

For deployment issues:
1. Check logs first
2. Verify configuration
3. Test health endpoints
4. Review monitoring metrics