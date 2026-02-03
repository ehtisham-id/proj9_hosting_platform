import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pool, redisClient } from '../config/database';
import Joi from 'joi';

export interface SecureRequest extends Request {
  user?: { userId: number; role: string };
  appId?: number;
}

// Advanced rate limiting per endpoint type
export const createRateLimit = (windowMs: number, max: number, prefix: string) =>
  rateLimit({
    windowMs,
    max,
    message: { error: 'Rate limit exceeded' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: SecureRequest) => `${prefix}:${req.user?.userId || req.ip}`,
    store: redisClient as any
  });

export const authRateLimit = createRateLimit(15 * 60 * 1000, 5, 'auth');
export const appRateLimit = createRateLimit(60 * 1000, 10, 'app');
export const deployRateLimit = createRateLimit(5 * 60 * 1000, 3, 'deploy');

// Input sanitization
export const sanitizeInput = (req: SecureRequest, res: Response, next: NextFunction) => {
  // Remove suspicious headers
  delete req.headers['x-forwarded-host'];
  delete req.headers['x-forwarded-server'];
  
  // Sanitize body
  if (req.body) {
    req.body = JSON.parse(JSON.stringify(req.body));
  }
  next();
};

// CSRF protection simulation
export const csrfProtection = (req: SecureRequest, res: Response, next: NextFunction) => {
  const token = req.headers['x-csrf-token'] as string;
  if (req.method !== 'GET' && !token) {
    return res.status(403).json({ error: 'CSRF token required' });
  }
  next();
};

// Enhanced JWT validation with Redis blacklist
export const validateJWT = async (req: SecureRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  // Check Redis blacklist
  const blacklisted = await redisClient.get(`blacklist:token:${token}`);
  if (blacklisted) {
    return res.status(401).json({ error: 'Token blacklisted' });
  }

  const decoded = verifyAccessToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Verify user exists
  const user = await pool.query('SELECT id, role FROM users WHERE id = $1', [decoded.userId]);
  if (user.rows.length === 0) {
    return res.status(401).json({ error: 'User not authorized' });
  }

  req.user = { userId: user.rows[0].id, role: user.rows[0].role };
  next();
};
