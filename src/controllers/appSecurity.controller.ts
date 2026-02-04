import { Request, Response } from 'express';
import { z } from 'zod';
import { createApp, getUserApps } from '../services/app.service';
import { appSchema } from '../validators/schema.validator';
import { SecureRequest } from '../middleware/advancedSecurity.middleware';

export const createAppSecure = async (req: SecureRequest, res: Response) => {
  try {
    const result = appSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: result.error.format() 
      });
    }

    const app = await createApp(req.user!.userId, result.data);
    res.status(201).json(app);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
