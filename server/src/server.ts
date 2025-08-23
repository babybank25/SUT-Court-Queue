import { createServer } from 'http';
import dotenv from 'dotenv';
import app from './app';
import { setupSocketIO } from './services/socket';
import { initializeDatabase, closeDatabase } from './database';
import { runMigrations } from './database/migrate';
import { logger } from './utils/logger';
import { monitoring } from './utils/monitoring';
import { courtStatusService } from './services/courtStatusService';

dotenv.config();

const server = createServer(app);
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

setupSocketIO(server);

const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully`);

  server.close(async () => {
    try {
      monitoring.shutdown();
      await closeDatabase();
      logger.info('Server shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', error);
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

export const startServer = async () => {
  try {
    logger.info('Starting SUT Court Queue server...', {
      environment: process.env.NODE_ENV,
      port: PORT,
      clientUrl: process.env.CLIENT_URL
    });

    if (isProduction) {
      logger.info('Running database migrations...');
      await runMigrations();
    }

    await initializeDatabase();
    logger.info('Database initialized successfully');

    const statusUpdateInterval = courtStatusService.startPeriodicUpdates();
    logger.info('Court status updates started');

    const cleanupInterval = () => {
      clearInterval(statusUpdateInterval);
    };

    process.on('SIGTERM', cleanupInterval);
    process.on('SIGINT', cleanupInterval);

    server.listen(PORT, () => {
      logger.info('Server started successfully', {
        port: PORT,
        clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
        environment: process.env.NODE_ENV || 'development',
        processId: process.pid
      });

      courtStatusService.getCurrentStatusAndEmit();

      if (isProduction) {
        logger.info('Production server ready for connections');
      } else {
        console.log(`🚀 Server running on port ${PORT}`);
      }
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  monitoring.incrementErrors(`Uncaught exception: ${error.message}`);
  process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  monitoring.incrementErrors(`Unhandled rejection: ${reason}`);
});
