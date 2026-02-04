import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/auth.service';
import { pool } from '../config/database.config';

export type UserRole = string;

export interface AuthRequest extends Request {
  user?: { userId: number; role: UserRole };
}

export const authenticateJWT = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const decoded = verifyAccessToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Fetch user from DB
  const result = await pool.query('SELECT id, role FROM users WHERE id = $1', [decoded.userId]);
  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'User not found' });
  }

  req.user = { userId: result.rows[0].id, role: result.rows[0].role };
  next();
};

export const requireRole = (roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Role ${req.user?.role || 'none'} not authorized` });
    }
    next();
  };
};

export const requireAppOwnership = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const appId = parseInt(req.params.id);
  const result = await pool.query(
    'SELECT user_id FROM apps WHERE id = $1',
    [appId]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'App not found' });
  }
  
  if (result.rows[0].user_id !== req.user!.userId) {
    return res.status(403).json({ error: 'Not app owner' });
  }
  
  next();
};
