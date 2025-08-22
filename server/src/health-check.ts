import { monitoring } from './utils/monitoring';
import { logger } from './utils/logger';

async function healthCheck(): Promise<void> {
  try {
    const result = await monitoring.performHealthCheck();
    
    if (result.status === 'healthy') {
      console.log('✅ Health check passed');
      process.exit(0);
    } else {
      console.log('❌ Health check failed');
      console.log(JSON.stringify(result, null, 2));
      process.exit(1);
    }
  } catch (error) {
    logger.error('Health check error', error);
    console.log('❌ Health check error:', error);
    process.exit(1);
  }
}

healthCheck();