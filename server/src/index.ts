import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import compression from 'compression';
import apiRoutes from './routes';
import { errorHandler, notFoundHandler, AppError } from './middleware';
import { initializeDatabase, closeDatabase } from './database';
import { setSocketInstance } from './services/socketService';
import { logger } from './utils/logger';
import { monitoring } from './utils/monitoring';
import { runMigrations } from './database/migrate';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);

// Configure CORS origins for production
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [process.env.CLIENT_URL || "http://localhost:3000"];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

// Trust proxy in production (for load balancers)
if (isProduction && process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// Compression middleware for production
if (isProduction && process.env.ENABLE_COMPRESSION === 'true') {
  app.use(compression());
}

// Security middleware
const helmetConfig = isProduction ? {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", ...allowedOrigins],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
} : {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
};

if (process.env.ENABLE_HELMET !== 'false') {
  app.use(helmet(helmetConfig));
}

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later.'
    },
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Request logging and monitoring middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  // Log request
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    referer: req.get('Referer')
  });
  
  // Update metrics
  monitoring.incrementRequests();
  
  // Log response when finished
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

// Health check endpoint
app.get('/api/health', async (req, res) => {
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

// Metrics endpoint (admin only in production)
app.get('/api/metrics', (req, res) => {
  if (isProduction) {
    // In production, this should be protected by admin auth
    // For now, we'll just return basic metrics
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

// API routes
app.use('/api', apiRoutes);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Initialize socket service
setSocketInstance(io);

// Import socket handlers
import { 
  handleConnection, 
  handleDisconnection 
} from './services/socketService';
import {
  handleJoinQueue,
  handleConfirmResult,
  handleAdminAction,
  handleJoinRoom,
  handleLeaveRoom
} from './services/socketHandlers';
import { courtStatusService } from './services/courtStatusService';

// Socket.IO connection handling
io.on('connection', (socket) => {
  // Handle new connection
  handleConnection(socket);
  
  // Update active connections metric
  monitoring.setActiveConnections(io.engine.clientsCount);
  
  // Set up event handlers
  socket.on('join-queue', (data) => handleJoinQueue(socket, data));
  socket.on('confirm-result', (data) => handleConfirmResult(socket, data));
  socket.on('admin-action', (data) => handleAdminAction(socket, data));
  socket.on('join-room', (data) => handleJoinRoom(socket, data));
  socket.on('leave-room', (data) => handleLeaveRoom(socket, data));
  
  // Handle disconnection
  socket.on('disconnect', () => {
    handleDisconnection(socket);
    monitoring.setActiveConnections(io.engine.clientsCount);
  });
  
  // Error handling for socket events
  socket.on('error', (error) => {
    logger.error(`Socket error from ${socket.id}`, error);
    monitoring.incrementErrors(`Socket error: ${error.message}`);
  });
});

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully`);
  
  server.close(async () => {
    try {
      // Close monitoring
      monitoring.shutdown();
      
      // Close database
      await closeDatabase();
      
      logger.info('Server shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', error);
      process.exit(1);
    }
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  monitoring.incrementErrors(`Uncaught exception: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  monitoring.incrementErrors(`Unhandled rejection: ${reason}`);
});

// Initialize server
async function startServer() {
  try {
    logger.info('Starting SUT Court Queue server...', {
      environment: process.env.NODE_ENV,
      port: PORT,
      clientUrl: process.env.CLIENT_URL
    });
    
    // Run database migrations in production
    if (isProduction) {
      logger.info('Running database migrations...');
      await runMigrations();
    }
    
    // Initialize database
    await initializeDatabase();
    logger.info('Database initialized successfully');
    
    // Start periodic court status updates
    const statusUpdateInterval = courtStatusService.startPeriodicUpdates();
    logger.info('Court status updates started');
    
    // Store interval for cleanup
    const cleanupInterval = () => {
      clearInterval(statusUpdateInterval);
    };
    
    process.on('SIGTERM', cleanupInterval);
    process.on('SIGINT', cleanupInterval);
    
    // Start server
    server.listen(PORT, () => {
      logger.info('Server started successfully', {
        port: PORT,
        clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
        environment: process.env.NODE_ENV || 'development',
        processId: process.pid
      });
      
      // Send initial court status
      courtStatusService.getCurrentStatusAndEmit();
      
      // Log startup completion
      if (isProduction) {
        logger.info('Production server ready for connections');
      } else {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📱 Client URL: ${process.env.CLIENT_URL || 'http://localhost:3000'}`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`💾 Database initialized successfully`);
        console.log(`⏰ Court status updates started`);
      }
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Start the server
startServer();