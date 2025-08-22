#!/bin/bash

# Production deployment script for SUT Court Queue
set -e

echo "🚀 Starting production deployment..."

# Check if required environment variables are set
if [ -z "$JWT_SECRET" ]; then
    echo "❌ JWT_SECRET environment variable is required"
    exit 1
fi

if [ -z "$ADMIN_PASSWORD" ]; then
    echo "❌ ADMIN_PASSWORD environment variable is required"
    exit 1
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p logs data ssl

# Build and deploy with Docker Compose
echo "🏗️ Building and starting services..."
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 30

# Run database migrations
echo "🗄️ Running database migrations..."
docker-compose -f docker-compose.prod.yml exec app npm run migrate

# Health check
echo "🏥 Performing health check..."
if docker-compose -f docker-compose.prod.yml exec app npm run health-check; then
    echo "✅ Deployment successful!"
    echo "🌐 Application is running at https://your-domain.com"
else
    echo "❌ Health check failed!"
    echo "📋 Checking logs..."
    docker-compose -f docker-compose.prod.yml logs app
    exit 1
fi

echo "🎉 Deployment completed successfully!"