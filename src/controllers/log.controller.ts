import { Request, Response } from 'express';
import { getAppLogs, getRecentLogs } from '../services/log.service';
import { AuthRequest } from '../middleware/rbac.middleware';
import { pool } from '../config/database.config';
import { startLogSimulation, stopLogSimulation } from '../services/log.simulator';

export const getLogsHandler = async (req: AuthRequest, res: Response) => {
  try {
    const appId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit as string) || 100;
    const since = req.query.since ? new Date(req.query.since as string) : undefined;

    // Verify app ownership
    const appResult = await pool.query(
      'SELECT user_id FROM apps WHERE id = $1',
      [appId]
    );
    
    if (appResult.rows.length === 0 || appResult.rows[0].user_id !== req.user!.userId) {
      return res.status(404).json({ error: 'App not found or access denied' });
    }

    const logs = await getAppLogs(appId, limit, since);
    
    // Start log simulation for testing (remove in production)
    startLogSimulation(appId);
    
    res.json({
      appId,
      logs,
      count: logs.length,
      hasMore: logs.length === limit
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
};

export const streamLogsHandler = async (req: AuthRequest, res: Response) => {
  const appId = parseInt(req.params.id);
  
  // Verify ownership (same as above)
  const appResult = await pool.query('SELECT user_id FROM apps WHERE id = $1', [appId]);
  if (appResult.rows.length === 0 || appResult.rows[0].user_id !== req.user!.userId) {
    return res.status(404).json({ error: 'App not found or access denied' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Simulate streaming (SSE-like)
  const interval = setInterval(async () => {
    const recentLogs = await getRecentLogs(appId);
    if (recentLogs.length > 0) {
      recentLogs.slice(-5).forEach(log => {
        res.write(`[${log.timestamp.toISOString()}] [${log.log_type.toUpperCase()}] ${log.message}\n`);
      });
    }
  }, 1000);

  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
};
