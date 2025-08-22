import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { 
  authenticateToken, 
  requireAdmin, 
  generateToken, 
  validateAdminCredentials,
  AuthRequest,
  AdminUser 
} from '../auth';
import { database } from '../../database';

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('bcryptjs');
jest.mock('../../database');

const mockJwt = jwt as jest.Mocked<typeof jwt>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockDatabase = database as jest.Mocked<typeof database>;

describe('Authentication Middleware', () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {}
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
    
    jest.clearAllMocks();
    
    // Set default environment variables
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRES_IN = '30d';
  });

  describe('authenticateToken', () => {
    it('should authenticate valid token', () => {
      const mockUser = { id: '1', username: 'admin', isAdmin: true };
      mockRequest.headers = { authorization: 'Bearer valid-token' };
      
      mockJwt.verify.mockImplementation((token, secret, callback: any) => {
        callback(null, mockUser);
      });

      authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockRequest.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject request without token', () => {
      mockRequest.headers = {};

      authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'Access token required'
        },
        timestamp: expect.any(String)
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with malformed authorization header', () => {
      mockRequest.headers = { authorization: 'InvalidFormat' };

      authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'Access token required'
        },
        timestamp: expect.any(String)
      });
    });

    it('should reject invalid token', () => {
      mockRequest.headers = { authorization: 'Bearer invalid-token' };
      
      mockJwt.verify.mockImplementation((token, secret, callback: any) => {
        callback(new Error('Invalid token'), null);
      });

      authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token'
        },
        timestamp: expect.any(String)
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should use fallback secret when JWT_SECRET not set', () => {
      delete process.env.JWT_SECRET;
      mockRequest.headers = { authorization: 'Bearer valid-token' };
      
      mockJwt.verify.mockImplementation((token, secret, callback: any) => {
        expect(secret).toBe('fallback-secret');
        callback(null, { id: '1', username: 'admin', isAdmin: true });
      });

      authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireAdmin', () => {
    it('should allow admin user', () => {
      mockRequest.user = { id: '1', username: 'admin', isAdmin: true };

      requireAdmin(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject non-admin user', () => {
      mockRequest.user = { id: '1', username: 'user', isAdmin: false };

      requireAdmin(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'ADMIN_REQUIRED',
          message: 'Admin privileges required'
        },
        timestamp: expect.any(String)
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request without user', () => {
      mockRequest.user = undefined;

      requireAdmin(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'ADMIN_REQUIRED',
          message: 'Admin privileges required'
        },
        timestamp: expect.any(String)
      });
    });
  });

  describe('generateToken', () => {
    it('should generate JWT token', () => {
      const user = { id: '1', username: 'admin', isAdmin: true };
      const expectedToken = 'generated-jwt-token';
      
      mockJwt.sign.mockReturnValue(expectedToken);

      const result = generateToken(user);

      expect(result).toBe(expectedToken);
      expect(mockJwt.sign).toHaveBeenCalledWith(
        { id: '1', username: 'admin', isAdmin: true },
        'test-secret',
        { expiresIn: '30d' }
      );
    });

    it('should use fallback values for environment variables', () => {
      delete process.env.JWT_SECRET;
      delete process.env.JWT_EXPIRES_IN;
      
      const user = { id: '1', username: 'admin', isAdmin: true };
      mockJwt.sign.mockReturnValue('token');

      generateToken(user);

      expect(mockJwt.sign).toHaveBeenCalledWith(
        user,
        'fallback-secret',
        { expiresIn: '30d' }
      );
    });
  });

  describe('validateAdminCredentials', () => {
    const mockAdmin: AdminUser = {
      id: '1',
      username: 'admin',
      password_hash: 'hashed-password',
      is_active: true,
      created_at: '2024-01-01',
      last_login: '2024-01-01'
    };

    it('should validate correct credentials', async () => {
      mockDatabase.get.mockResolvedValue(mockAdmin);
      mockBcrypt.compare.mockResolvedValue(true);
      mockDatabase.run.mockResolvedValue({ changes: 1 });

      const result = await validateAdminCredentials('admin', 'password');

      expect(result).toEqual(mockAdmin);
      expect(mockDatabase.get).toHaveBeenCalledWith(
        'SELECT * FROM admin_users WHERE username = ? AND is_active = 1',
        ['admin']
      );
      expect(mockBcrypt.compare).toHaveBeenCalledWith('password', 'hashed-password');
      expect(mockDatabase.run).toHaveBeenCalledWith(
        'UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
        ['1']
      );
    });

    it('should return null for non-existent user', async () => {
      mockDatabase.get.mockResolvedValue(null);

      const result = await validateAdminCredentials('nonexistent', 'password');

      expect(result).toBeNull();
      expect(mockBcrypt.compare).not.toHaveBeenCalled();
    });

    it('should return null for incorrect password', async () => {
      mockDatabase.get.mockResolvedValue(mockAdmin);
      mockBcrypt.compare.mockResolvedValue(false);

      const result = await validateAdminCredentials('admin', 'wrongpassword');

      expect(result).toBeNull();
      expect(mockBcrypt.compare).toHaveBeenCalledWith('wrongpassword', 'hashed-password');
    });

    it('should return null for inactive user', async () => {
      const inactiveAdmin = { ...mockAdmin, is_active: false };
      mockDatabase.get.mockResolvedValue(inactiveAdmin);

      const result = await validateAdminCredentials('admin', 'password');

      expect(result).toBeNull();
      expect(mockBcrypt.compare).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockDatabase.get.mockRejectedValue(new Error('Database error'));

      const result = await validateAdminCredentials('admin', 'password');

      expect(result).toBeNull();
    });

    it('should handle bcrypt errors gracefully', async () => {
      mockDatabase.get.mockResolvedValue(mockAdmin);
      mockBcrypt.compare.mockRejectedValue(new Error('Bcrypt error'));

      const result = await validateAdminCredentials('admin', 'password');

      expect(result).toBeNull();
    });

    it('should handle last login update errors gracefully', async () => {
      mockDatabase.get.mockResolvedValue(mockAdmin);
      mockBcrypt.compare.mockResolvedValue(true);
      mockDatabase.run.mockRejectedValue(new Error('Update failed'));

      // Should still return the admin user even if last login update fails
      const result = await validateAdminCredentials('admin', 'password');

      expect(result).toEqual(mockAdmin);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete authentication flow', () => {
      const mockUser = { id: '1', username: 'admin', isAdmin: true };
      mockRequest.headers = { authorization: 'Bearer valid-token' };
      
      // Mock successful token verification
      mockJwt.verify.mockImplementation((token, secret, callback: any) => {
        callback(null, mockUser);
      });

      // Test authenticateToken
      authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);
      expect(mockRequest.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalledTimes(1);

      // Reset mockNext for requireAdmin test
      mockNext.mockClear();

      // Test requireAdmin
      requireAdmin(mockRequest as AuthRequest, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should handle authentication failure in flow', () => {
      mockRequest.headers = { authorization: 'Bearer invalid-token' };
      
      mockJwt.verify.mockImplementation((token, secret, callback: any) => {
        callback(new Error('Invalid token'), null);
      });

      authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRequest.user).toBeUndefined();
    });
  });
});