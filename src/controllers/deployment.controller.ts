import { Request, Response } from 'express';
import { dockerSandbox } from '../services/docker.service';
import { getInstanceCount, getScalingMetrics } from '../services/scaling.service';
import { AuthRequest } from '../middleware/rbac.middleware';
import { pool } from '../config/database.config';
import Joi from 'joi';

const deploySchema = Joi.object({
  instances: Joi.number().min(1).max(10).optional(),
  env_vars: Joi.object().optional()
});

export const deployHandler = async (req: AuthRequest, res: Response) => {
  try {
    const appId = parseInt(req.params.id);
    
    // Verify ownership
    const appResult = await pool.query('SELECT user_id FROM apps WHERE id = $1', [appId]);
    if (appResult.rows.length === 0 || appResult.rows[0].user_id !== req.user!.userId) {
      return res.status(403).json({ error: 'App not found or access denied' });
    }

    const instances = parseInt(req.body.instances) || await getInstanceCount(appId);
    const envVars: Record<string, string> = req.body.env_vars || {};

    // Deploy with sandbox
    const deployedCount = await dockerSandbox.deployApp(appId, instances, envVars);
    
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
    const containers = await dockerSandbox.getContainers(appId);
    res.json({ containers, count: containers.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch containers' });
  }
};
