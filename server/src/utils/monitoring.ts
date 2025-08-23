import { Application, Request, Response, NextFunction } from 'express';
import { logger } from './logger';

interface SystemMetrics {
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  activeConnections: number;
  totalRequests: number;
  errorCount: number;
  lastError?: string;
}

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  metrics: SystemMetrics;
  checks: {
    database: boolean;
    memory: boolean;
    disk: boolean;
  };
}

class MonitoringService {
  private metrics: SystemMetrics;
  private startTime: number;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor() {
    this.startTime = Date.now();
    this.metrics = {
      uptime: 0,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      activeConnections: 0,
      totalRequests: 0,
      errorCount: 0
    };

    this.startHealthChecks();
  }

  private startHealthChecks(): void {
    if (process.env.NODE_ENV === 'production') {
      const interval = parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000');
      this.healthCheckInterval = setInterval(() => {
        this.performHealthCheck();
      }, interval);
    }
  }

  updateMetrics(update: Partial<SystemMetrics>): void {
    this.metrics = { ...this.metrics, ...update };
    this.metrics.uptime = Date.now() - this.startTime;
  }

  incrementRequests(): void {
    this.metrics.totalRequests++;
  }

  incrementErrors(error?: string): void {
    this.metrics.errorCount++;
    if (error) {
      this.metrics.lastError = error;
    }
  }

  setActiveConnections(count: number): void {
    this.metrics.activeConnections = count;
  }

  async performHealthCheck(): Promise<HealthCheckResult> {
    const timestamp = new Date().toISOString();
    const uptime = Date.now() - this.startTime;
    const version = process.env.npm_package_version || '1.0.0';

    this.metrics.memoryUsage = process.memoryUsage();
    this.metrics.cpuUsage = process.cpuUsage();
    this.metrics.uptime = uptime;

    const checks = {
      database: await this.checkDatabase(),
      memory: this.checkMemory(),
      disk: this.checkDisk()
    };

    const status = Object.values(checks).every(check => check) ? 'healthy' : 'unhealthy';

    const result: HealthCheckResult = {
      status,
      timestamp,
      uptime,
      version,
      metrics: { ...this.metrics },
      checks
    };

    if (status === 'unhealthy') {
      logger.error('Health check failed', result);
    } else {
      logger.info('Health check passed', { uptime, activeConnections: this.metrics.activeConnections });
    }

    return result;
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      return true;
    } catch (error) {
      logger.error('Database health check failed', error);
      return false;
    }
  }

  private checkMemory(): boolean {
    const memUsage = process.memoryUsage();
    const maxMemory = 512 * 1024 * 1024; // 512MB threshold
    
    if (memUsage.heapUsed > maxMemory) {
      logger.warn('High memory usage detected', { 
        heapUsed: memUsage.heapUsed,
        threshold: maxMemory 
      });
      return false;
    }
    
    return true;
  }

  private checkDisk(): boolean {
    return true;
  }

  getMetrics(): SystemMetrics {
    return { ...this.metrics };
  }

  shutdown(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    logger.info('Monitoring service shutdown');
  }
}

export const monitoring = new MonitoringService();
export { HealthCheckResult, SystemMetrics };

export const setupMonitoring = (app: Application) => {
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    logger.info(`${req.method} ${req.path}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer')
    });

    monitoring.incrementRequests();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const level = res.statusCode >= 400 ? 'warn' : 'info';

      logger[level](`${req.method} ${req.path} ${res.statusCode}`, {
        duration,
        statusCode: res.statusCode,
        contentLength: res.get('Content-Length')
      });

      if (res.statusCode >= 400) {
        monitoring.incrementErrors(`${res.statusCode} ${req.method} ${req.path}`);
      }
    });

    next();
  });

  app.get('/api/health', async (req: Request, res: Response) => {
    try {
      const healthResult = await monitoring.performHealthCheck();
      res.status(healthResult.status === 'healthy' ? 200 : 503).json({
        success: healthResult.status === 'healthy',
        data: healthResult
      });
    } catch (error) {
      logger.error('Health check failed', error);
      res.status(503).json({
        success: false,
        error: {
          code: 'HEALTH_CHECK_FAILED',
          message: 'Health check failed'
        },
        timestamp: new Date().toISOString()
      });
    }
  });

  app.get('/api/metrics', (req: Request, res: Response) => {
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      const metrics = monitoring.getMetrics();
      res.json({
        success: true,
        data: metrics
      });
    } else {
      const metrics = monitoring.getMetrics();
      res.json({
        success: true,
        data: metrics
      });
    }
  });
};