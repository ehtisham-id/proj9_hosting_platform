import { Response } from 'express';
import { 
  createEnvVar, getAppEnvVars, updateEnvVar, deleteEnvVar 
} from '../services/env.service';
import { AuthRequest } from '../middleware/rbac.middleware';
import Joi from 'joi';
import { pool } from '../config/database.config';

const parseAppId = (req: AuthRequest, res: Response): number | null => {
  const appId = parseInt(req.params.id);
  if (isNaN(appId)) {
    res.status(400).json({ error: 'Invalid app id' });
    return null;
  }
  return appId;
};

const envVarSchema = Joi.object({
  key: Joi.string().min(1).max(100).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/).required()
    .messages({ 'string.pattern.base': 'Key must be alphanumeric with underscores, starting with letter' }),
  value: Joi.string().max(5000).required()
});

const envVarValueSchema = Joi.object({
  value: Joi.string().max(5000).required()
});

export const createEnvHandler = async (req: AuthRequest, res: Response) => {
  const { error, value } = envVarSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const appId = parseAppId(req, res);
    if (appId === null) return;
    
    // Verify app ownership
    const appResult = await pool.query(
      'SELECT user_id FROM apps WHERE id = $1',
      [appId]
    );
    
    if (appResult.rows.length === 0 || appResult.rows[0].user_id !== req.user!.userId) {
      return res.status(404).json({ error: 'App not found or access denied' });
    }

    // Check if key already exists
    const existing = await pool.query(
      'SELECT id FROM app_env WHERE app_id = $1 AND key = $2',
      [appId, value.key]
    );
    
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Environment variable already exists' });
    }

    const envVar = await createEnvVar(appId, value.key, value.value);
    res.status(201).json(envVar);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create environment variable' });
  }
};

export const listEnvHandler = async (req: AuthRequest, res: Response) => {
  try {
    const appId = parseAppId(req, res);
    if (appId === null) return;
    
    // Verify app ownership
    const appResult = await pool.query(
      'SELECT user_id FROM apps WHERE id = $1',
      [appId]
    );
    
    if (appResult.rows.length === 0 || appResult.rows[0].user_id !== req.user!.userId) {
      return res.status(404).json({ error: 'App not found or access denied' });
    }

    const envVars = await getAppEnvVars(appId);
    res.json(envVars);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch environment variables' });
  }
};

export const updateEnvHandler = async (req: AuthRequest, res: Response) => {
  const { error, value } = envVarValueSchema.validate({ value: req.body.value });
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const appId = parseAppId(req, res);
    if (appId === null) return;
    const key = req.params.key;
    
    // Verify app ownership
    const appResult = await pool.query(
      'SELECT user_id FROM apps WHERE id = $1',
      [appId]
    );
    
    if (appResult.rows.length === 0 || appResult.rows[0].user_id !== req.user!.userId) {
      return res.status(404).json({ error: 'App not found or access denied' });
    }

    const envVar = await updateEnvVar(appId, key, value.value);
    if (!envVar) {
      return res.status(404).json({ error: 'Environment variable not found' });
    }
    
    res.json(envVar);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update environment variable' });
  }
};

export const deleteEnvHandler = async (req: AuthRequest, res: Response) => {
  try {
    const appId = parseAppId(req, res);
    if (appId === null) return;
    const key = req.params.key;
    
    // Verify app ownership
    const appResult = await pool.query(
      'SELECT user_id FROM apps WHERE id = $1',
      [appId]
    );
    
    if (appResult.rows.length === 0 || appResult.rows[0].user_id !== req.user!.userId) {
      return res.status(404).json({ error: 'App not found or access denied' });
    }

    await deleteEnvVar(appId, key);
    res.json({ message: 'Environment variable deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete environment variable' });
  }
};
