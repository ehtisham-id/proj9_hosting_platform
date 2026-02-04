import { pool } from '../config/database.config';

export interface LogEntry {
  id: number;
  app_id: number;
  log_type: 'stdout' | 'stderr';
  message: string;
  timestamp: Date;
  instance_id?: string;
}

export const saveLog = async (
  appId: number, 
  logType: 'stdout' | 'stderr', 
  message: string, 
  instanceId?: string
): Promise<void> => {
  await pool.query(
    `INSERT INTO app_logs (app_id, log_type, message, instance_id)
     VALUES ($1, $2, $3, $4)`,
    [appId, logType, message, instanceId]
  );
};

export const getAppLogs = async (
  appId: number, 
  limit: number = 100, 
  since?: Date
): Promise<LogEntry[]> => {
  const query = `
    SELECT id, app_id, log_type, message, timestamp, instance_id
    FROM app_logs 
    WHERE app_id = $1 ${since ? 'AND timestamp > $2' : ''}
    ORDER BY timestamp DESC 
    LIMIT $3
  `;
  const params = since ? [appId, since, limit] : [appId, limit];
  
  const result = await pool.query(query, params);
  return result.rows.reverse(); // Newest first in DB, return oldest first
};

export const getRecentLogs = async (appId: number): Promise<LogEntry[]> => {
  return getAppLogs(appId, 50);
};

export const clearOldLogs = async (appId: number, days: number = 7): Promise<void> => {
  await pool.query(
    `DELETE FROM app_logs 
     WHERE app_id = $1 
     AND timestamp < NOW() - INTERVAL '${days} days'`,
    [appId]
  );
};
