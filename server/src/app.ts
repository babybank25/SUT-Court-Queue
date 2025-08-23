import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import apiRoutes from './routes';
import { errorHandler, notFoundHandler } from './middleware';
import { setupMonitoring } from './utils/monitoring';
import { setupRateLimiter } from './config/rateLimiter';
import { helmetConfig } from './config/helmet';
import { corsOptions } from './config/cors';

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// Trust proxy in production
if (isProduction && process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// Enable compression in production
if (isProduction && process.env.ENABLE_COMPRESSION === 'true') {
  app.use(compression());
}

// Security headers
if (process.env.ENABLE_HELMET !== 'false') {
  app.use(helmet(helmetConfig));
}

// CORS
app.use(cors(corsOptions));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
setupRateLimiter(app);

// Monitoring and logging
setupMonitoring(app);

// API routes
app.use('/api', apiRoutes);

// 404 Handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

export default app;
