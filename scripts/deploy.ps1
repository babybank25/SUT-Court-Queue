# Production deployment script for SUT Court Queue (PowerShell)
param(
    [string]$JwtSecret,
    [string]$AdminPassword
)

Write-Host "🚀 Starting production deployment..." -ForegroundColor Green

# Check if required parameters are provided
if (-not $JwtSecret) {
    Write-Host "❌ JWT_SECRET parameter is required" -ForegroundColor Red
    Write-Host "Usage: .\deploy.ps1 -JwtSecret 'your-secret' -AdminPassword 'your-password'"
    exit 1
}

if (-not $AdminPassword) {
    Write-Host "❌ ADMIN_PASSWORD parameter is required" -ForegroundColor Red
    Write-Host "Usage: .\deploy.ps1 -JwtSecret 'your-secret' -AdminPassword 'your-password'"
    exit 1
}

# Set environment variables
$env:JWT_SECRET = $JwtSecret
$env:ADMIN_PASSWORD = $AdminPassword

try {
    # Create necessary directories
    Write-Host "📁 Creating directories..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path "logs", "data", "ssl" | Out-Null

    # Build and deploy with Docker Compose
    Write-Host "🏗️ Building and starting services..." -ForegroundColor Yellow
    docker-compose -f docker-compose.prod.yml down
    docker-compose -f docker-compose.prod.yml build --no-cache
    docker-compose -f docker-compose.prod.yml up -d

    # Wait for services to be healthy
    Write-Host "⏳ Waiting for services to be healthy..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30

    # Run database migrations
    Write-Host "🗄️ Running database migrations..." -ForegroundColor Yellow
    docker-compose -f docker-compose.prod.yml exec app npm run migrate

    # Health check
    Write-Host "🏥 Performing health check..." -ForegroundColor Yellow
    $healthCheck = docker-compose -f docker-compose.prod.yml exec app npm run health-check
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Deployment successful!" -ForegroundColor Green
        Write-Host "🌐 Application is running at https://your-domain.com" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Health check failed!" -ForegroundColor Red
        Write-Host "📋 Checking logs..." -ForegroundColor Yellow
        docker-compose -f docker-compose.prod.yml logs app
        exit 1
    }

    Write-Host "🎉 Deployment completed successfully!" -ForegroundColor Green
}
catch {
    Write-Host "❌ Deployment failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}