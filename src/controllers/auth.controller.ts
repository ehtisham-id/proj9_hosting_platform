import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import {pool} from '../config/database.config';
import { createUser, findUserByEmail, generateTokens, verifyRefreshToken, saveRefreshToken, verifyPassword, invalidateRefreshToken } from '../services/auth.service';

export const signup = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const user = await createUser(email, password);
    const { accessToken, refreshToken } = generateTokens(user);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await saveRefreshToken(user.id, refreshToken, expiresAt);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({ 
      message: 'User created successfully',
      user: { id: user.id, email: user.email },
      accessToken 
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    const user = await findUserByEmail(email);
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = generateTokens(user);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await saveRefreshToken(user.id, refreshToken, expiresAt);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ 
      message: 'Login successful',
      user: { id: user.id, email: user.email },
      accessToken 
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token' });
    }

    const decoded = jwt.decode(refreshToken) as any;
    if (!decoded?.userId) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const isValid = await verifyRefreshToken(decoded.userId, refreshToken);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const user = await findUserByEmail(decoded.email || ''); // Fallback
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await saveRefreshToken(user.id, newRefreshToken, expiresAt);

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ accessToken });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      const decoded = jwt.decode(refreshToken) as any;
      if (decoded?.userId) {
        await invalidateRefreshToken(decoded.userId);
      }
    }

    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// In authController.ts signup function, after creating user:
await pool.query(
  "UPDATE users SET role = $1 WHERE id = $2",
  ['user', user.id]
);

// Admin signup (for testing)
export const adminSignup = async (req: Request, res: Response) => {
  // Same as signup but set role = 'admin'
  // Add requireRole(['admin']) middleware for production
};
