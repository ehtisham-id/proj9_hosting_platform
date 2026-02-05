import { Response, NextFunction } from 'express';
import { redisClient } from '../config/database.config';
import { AuthRequest } from './rbac.middleware';

export interface SecureRequest extends AuthRequest {}

export const auditTrail = async (req: SecureRequest, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', async () => {
    const duration = Date.now() - start;
    const logEntry = {
      userId: req.user?.userId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration,
      ip: req.ip
    };
    
    // Log to Redis for real-time monitoring
    await redisClient.lPush('security:audit', JSON.stringify(logEntry));
    await redisClient.lTrim('security:audit', 0, 999); // Keep last 1000
  });
  
  next();
};

