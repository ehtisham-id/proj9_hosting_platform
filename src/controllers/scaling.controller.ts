import { Request, Response } from 'express';
import { 
  scaleUp, scaleDown, getInstanceCount, getScalingMetrics, setInstanceCount 
} from '../services/scaling.service';
import { AuthRequest } from '../middleware/rbac.middleware';
import { pool } from '../config/database.config';
import Joi from 'joi';

const scaleSchema = Joi.object({
  instances: Joi.number().min(1).max(20).required()
});

export const scaleHandler = async (req: AuthRequest, res: Response) => {
  const { error, value } = scaleSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const appId = parseInt(req.params.id);
    
    // Verify ownership
    const appResult = await pool.query('SELECT user_id FROM apps WHERE id = $1', [appId]);
    if (appResult.rows.length === 0 || appResult.rows[0].user_id !== req.user!.userId) {
      return res.status(404).json({ error: 'App not found or access denied' });
    }

    const newCount = await setInstanceCount(appId, value.instances);
    
    res.json({
      message: `Scaled to ${newCount} instances`,
      instances: newCount,
      status: 'success'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to scale app' });
  }
};

export const scaleUpHandler = async (req: AuthRequest, res: Response) => {
  try {
    const appId = parseInt(req.params.id);
    const increment = parseInt(req.query.increment as string) || 1;
    
    // Ownership check (same as above)
    const appResult = await pool.query('SELECT user_id FROM apps WHERE id = $1', [appId]);
    if (appResult.rows.length === 0 || appResult.rows[0].user_id !== req.user!.userId) {
      return res.status(404).json({ error: 'App not found' });
    }

    const newCount = await scaleUp(appId, increment);
    res.json({ instances: newCount, action: 'scale_up' });
  } catch (error) {
    res.status(500).json({ error: 'Scale up failed' });
  }
};

export const scaleDownHandler = async (req: AuthRequest, res: Response) => {
  try {
    const appId = parseInt(req.params.id);
    const decrement = parseInt(req.query.decrement as string) || 1;
    
    const appResult = await pool.query('SELECT user_id FROM apps WHERE id = $1', [appId]);
    if (appResult.rows.length === 0 || appResult.rows[0].user_id !== req.user!.userId) {
      return res.status(404).json({ error: 'App not found' });
    }

    const newCount = await scaleDown(appId, decrement);
    res.json({ instances: newCount, action: 'scale_down' });
  } catch (error) {
    res.status(500).json({ error: 'Scale down failed' });
  }
};

export const metricsHandler = async (req: AuthRequest, res: Response) => {
  try {
    const appId = parseInt(req.params.id);
    
    const appResult = await pool.query('SELECT user_id FROM apps WHERE id = $1', [appId]);
    if (appResult.rows.length === 0 || appResult.rows[0].user_id !== req.user!.userId) {
      return res.status(404).json({ error: 'App not found' });
    }

    const metrics = await getScalingMetrics(appId);
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
};
