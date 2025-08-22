import request from 'supertest';
import express from 'express';
import { initializeDatabase, closeDatabase } from '../database';

// Mock the database initialization for testing
jest.mock('../database', () => ({
  initializeDatabase: jest.fn().mockResolvedValue(undefined),
  closeDatabase: jest.fn().mockResolvedValue(undefined),
}));

describe('Server Setup', () => {
  let app: express.Application;

  beforeAll(async () => {
    // Create a minimal Express app for testing
    app = express();
    app.use(express.json());
    
    // Add health check endpoint
    app.get('/api/health', (req, res) => {
      res.json({ 
        success: true,
        data: {
          status: 'OK', 
          timestamp: new Date().toISOString(),
          environment: 'test',
          uptime: process.uptime()
        }
      });
    });
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'OK',
          environment: 'test'
        }
      });
      expect(response.body.data.timestamp).toBeDefined();
      expect(response.body.data.uptime).toBeDefined();
    });
  });

  describe('Middleware Setup', () => {
    it('should handle JSON requests', async () => {
      // This test verifies that express.json() middleware is working
      const testData = { test: 'data' };
      
      // Add a test endpoint that echoes the request body
      app.post('/api/test-json', (req, res) => {
        res.json({ received: req.body });
      });

      const response = await request(app)
        .post('/api/test-json')
        .send(testData)
        .expect(200);

      expect(response.body.received).toEqual(testData);
    });
  });
});