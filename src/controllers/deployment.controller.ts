import { Response } from 'express';
import { dockerSandbox } from '../services/docker.service';
import { getInstanceCount, getScalingMetrics } from '../services/scaling.service';
import { AuthRequest } from '../middleware/rbac.middleware';
import { pool } from '../config/database.config';
import Joi from 'joi';

const deploySchema = Joi.object({
  instances: Joi.number().min(1).max(10).optional(),
  env_vars: Joi.object().optional(),
  image: Joi.string().max(500).optional()
});

export const deployHandler = async (req: AuthRequest, res: Response) => {
  const { error, value } = deploySchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const appId = parseInt(req.params.id);
    if (isNaN(appId)) {
      return res.status(400).json({ error: 'Invalid app id' });
    }
    
    // Verify ownership
    const appResult = await pool.query('SELECT user_id FROM apps WHERE id = $1', [appId]);
    if (appResult.rows.length === 0 || appResult.rows[0].user_id !== req.user!.userId) {
      return res.status(403).json({ error: 'App not found or access denied' });
    }

    const instances = value.instances ? parseInt(String(value.instances)) : await getInstanceCount(appId);
    const envVars: Record<string, string> = value.env_vars || {};
    const image: string | undefined = value.image;

    // Deploy with sandbox
    const deployedCount = await dockerSandbox.deployApp(appId, instances, envVars, image);
    
    // Update app status
    await pool.query("UPDATE apps SET status = 'running', last_deployed = NOW() WHERE id = $1", [appId]);
    
    const metrics = await getScalingMetrics(appId);
    
    res.json({
      message: `Deployed ${deployedCount} instances successfully`,
      instances: deployedCount,
      status: 'running',
      containers: await dockerSandbox.getContainers(appId),
      metrics
    });
  } catch (error) {
    res.status(500).json({ error: 'Deployment failed', details: (error as Error).message });
  }
};

export const stopHandler = async (req: AuthRequest, res: Response) => {
  try {
    const appId = parseInt(req.params.id);
    if (isNaN(appId)) {
      return res.status(400).json({ error: 'Invalid app id' });
    }
    
    // Ownership check
    const appResult = await pool.query('SELECT user_id FROM apps WHERE id = $1', [appId]);
    if (appResult.rows.length === 0 || appResult.rows[0].user_id !== req.user!.userId) {
      return res.status(403).json({ error: 'App not found' });
    }

    await dockerSandbox.stopApp(appId);
    await pool.query("UPDATE apps SET status = 'stopped' WHERE id = $1", [appId]);
    
    res.json({ message: 'App stopped successfully', status: 'stopped' });
  } catch (error) {
    res.status(500).json({ error: 'Stop failed' });
  }
};

export const containersHandler = async (req: AuthRequest, res: Response) => {
  try {
    const appId = parseInt(req.params.id);
    if (isNaN(appId)) {
      return res.status(400).json({ error: 'Invalid app id' });
    }
    const appResult = await pool.query('SELECT user_id FROM apps WHERE id = $1', [appId]);
    if (appResult.rows.length === 0 || appResult.rows[0].user_id !== req.user!.userId) {
      return res.status(403).json({ error: 'App not found' });
    }
    const containers = await dockerSandbox.getContainers(appId);
    res.json({ containers, count: containers.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch containers' });
  }
};
