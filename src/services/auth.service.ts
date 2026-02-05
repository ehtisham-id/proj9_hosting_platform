import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, redisClient } from '../config/database.config';

const JWT_SECRET = process.env.JWT_SECRET || 'heroku-clone-secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'heroku-clone-refresh-secret';

interface User {
  id: number;
  email: string;
}

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 12);
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateTokens = (user: User) => {
  const accessToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

export const verifyAccessToken = (token: string): { userId: number } | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: number };
  } catch {
    return null;
  }
};

export const createUser = async (email: string, password: string) => {
  const passwordHash = await hashPassword(password);
  const result = await pool.query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
    [email, passwordHash]
  );
  return result.rows[0];
};

export const findUserByEmail = async (email: string) => {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0];
};

export const findUserById = async (userId: number) => {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
  return result.rows[0];
};

export const saveRefreshToken = async (userId: number, token: string, expiresAt: Date) => {
  const tokenHash = await hashPassword(token);
  const ttlSeconds = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  await redisClient.set(`refresh:${userId}`, tokenHash, { EX: ttlSeconds });
};

export const verifyRefreshToken = async (userId: number, token: string) => {
  const storedHash = await redisClient.get(`refresh:${userId}`);
  if (!storedHash) return false;
  return verifyPassword(token, storedHash);
};

export const invalidateRefreshToken = async (userId: number) => {
  await redisClient.del(`refresh:${userId}`);
};
