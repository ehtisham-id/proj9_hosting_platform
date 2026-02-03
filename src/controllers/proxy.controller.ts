import { Request, Response } from 'express';
import { nginxManager } from '../services/nginxService';
import { AuthRequest } from '../middleware/rbac';
import { pool } from '../config/database';

export const generateProxyHandler = async (req: AuthRequest, res: Response) => {
  try {
    const appId = parseInt(req.params.id);
    
    // Ownership check
    const appResult = await pool.query('SELECT user_id FROM apps WHERE id = $1', [appId]);
    if (appResult.rows.length === 0 || appResult.rows[0].user_id !== req.user!.userId) {
      return res.status(403).json({ error: 'App not found or access denied' });
    }

    const config = await nginxManager.generateAppConfig(appId);
    await nginxManager.generateMainConfig();
    await nginxManager.reloadNginx();

    res.json({
      message: 'NGINX config generated and reloaded',
      config: {
        appUrl: `${config.appName}.heroku-clone.local`,
        ports: config.ports,
        instances: config.upstreams.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate proxy config', details: (error as Error).message });
  }
};

export const proxyStatusHandler = async (req: AuthRequest, res: Response) => {
  try {
    const appId = parseInt(req.params.id);
    const configPath = `/tmp/nginx-heroku-clone/app-${appId}.conf`;
    
    try {
      await fs.access(configPath);
      res.json({ status: 'active', configGenerated: true });
    } catch {
      res.json({ status: 'pending', configGenerated: false });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to check proxy status' });
  }
};
