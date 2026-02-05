import rateLimit from 'express-rate-limit';
import { redisClient } from '../config/database.config';
import { Response, NextFunction } from 'express';
import { AuthRequest } from './rbac.middleware';

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Too many login attempts, try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false
});

export const ipWhitelist = (req: AuthRequest, res: Response, next: NextFunction) => {
  const allowedIPs = process.env.ALLOWED_IPS?.split(',') || ['127.0.0.1', '::1'];
  const clientIP = req.ip || req.connection.remoteAddress;
  
  if (!allowedIPs.includes(clientIP??'')) {
    return res.status(403).json({ error: 'IP not whitelisted' });
  }
  next();
};

export const ipBlacklist = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  const blacklisted = await redisClient.get(`blacklist:${clientIP}`);
  
  if (blacklisted) {
    return res.status(403).json({ error: 'IP blacklisted' });
  }
  next();
};
