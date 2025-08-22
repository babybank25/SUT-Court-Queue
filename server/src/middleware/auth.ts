import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { database } from '../database';
import { AppError } from './errorHandler';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    isAdmin: boolean;
  };
}

export interface AdminUser {
  id: string;
  username: string;
  password_hash: string;
  is_active: boolean;
  created_at: string;
  last_login?: string;
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false,
      error: {
        code: 'NO_TOKEN',
        message: 'Access token required'
      },
      timestamp: new Date().toISOString()
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', (err, user) => {
    if (err) {
      return res.status(403).json({ 
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token'
        },
        timestamp: new Date().toISOString()
      });
    }
    req.user = user as AuthRequest['user'];
    next();
  });
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'ADMIN_REQUIRED',
        message: 'Admin privileges required'
      },
      timestamp: new Date().toISOString()
    });
  }
  next();
};

export const generateToken = (user: { id: string; username: string; isAdmin: boolean }): string => {
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username, 
      isAdmin: user.isAdmin 
    },
    process.env.JWT_SECRET || 'fallback-secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
  );
};

export const validateAdminCredentials = async (username: string, password: string): Promise<AdminUser | null> => {
  try {
    const admin = await database.get<AdminUser>(
      'SELECT * FROM admin_users WHERE username = ? AND is_active = 1',
      [username]
    );

    if (!admin) {
      return null;
    }

    const isValidPassword = await bcrypt.compare(password, admin.password_hash);
    if (!isValidPassword) {
      return null;
    }

    // Update last login
    await database.run(
      'UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [admin.id]
    );

    return admin;
  } catch (error) {
    console.error('Error validating admin credentials:', error);
    return null;
  }
};