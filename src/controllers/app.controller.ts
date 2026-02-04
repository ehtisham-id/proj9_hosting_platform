import { Request, Response } from 'express';
import { 
  createApp, getUserApps, getAppById, updateApp, deleteApp 
} from '../services/app.service';
import { AuthRequest } from '../middleware/rbac.middleware';
import Joi from 'joi';

const createSchema = Joi.object({
  name: Joi.string().min(3).max(50).required(),
  git_url: Joi.string().uri().max(500).optional()
});

export const createAppHandler = async (req: AuthRequest, res: Response) => {
  const { error, value } = createSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const app = await createApp(req.user!.userId, value);
    res.status(201).json(app);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create app' });
  }
};

export const listAppsHandler = async (req: AuthRequest, res: Response) => {
  try {
    const apps = await getUserApps(req.user!.userId);
    res.json(apps);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch apps' });
  }
};

export const getAppHandler = async (req: AuthRequest, res: Response) => {
  try {
    const appId = parseInt(req.params.id);
    const app = await getAppById(appId);
    
    if (!app || app.user_id !== req.user!.userId) {
      return res.status(404).json({ error: 'App not found' });
    }
    
    res.json(app);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch app' });
  }
};

export const updateAppHandler = async (req: AuthRequest, res: Response) => {
  const updateSchema = Joi.object({
    name: Joi.string().min(3).max(50).optional(),
    git_url: Joi.string().uri().max(500).optional(),
    status: Joi.string().valid('stopped', 'running', 'restarting').optional()
  }).min(1);

  const { error, value } = updateSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const appId = parseInt(req.params.id);
    const app = await updateApp(appId, req.user!.userId, value);
    
    if (!app) {
      return res.status(404).json({ error: 'App not found or not owned' });
    }
    
    res.json(app);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update app' });
  }
};

export const deleteAppHandler = async (req: AuthRequest, res: Response) => {
  try {
    const appId = parseInt(req.params.id);
    await deleteApp(appId, req.user!.userId);
    res.json({ message: 'App deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete app' });
  }
};
