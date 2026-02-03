import { pool } from '../config/database';
import { AuthRequest } from '../middleware/rbac';

export interface CreateAppInput {
  name: string;
  git_url?: string;
}

export interface App {
  id: number;
  name: string;
  user_id: number;
  git_url?: string;
  status: string;
  instances: number;
  created_at: Date;
  last_deployed?: Date;
}

export const createApp = async (userId: number, data: CreateAppInput): Promise<App> => {
  const result = await pool.query(
    `INSERT INTO apps (name, git_url, user_id) 
     VALUES ($1, $2, $3) 
     RETURNING id, name, user_id, git_url, status, instances, created_at, last_deployed`,
    [data.name, data.git_url, userId]
  );
  return result.rows[0];
};

export const getUserApps = async (userId: number): Promise<App[]> => {
  const result = await pool.query(
    `SELECT id, name, git_url, status, instances, created_at, last_deployed 
     FROM apps WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
};

export const getAppById = async (appId: number): Promise<App | null> => {
  const result = await pool.query(
    `SELECT id, name, git_url, status, instances, created_at, last_deployed, user_id
     FROM apps WHERE id = $1`,
    [appId]
  );
  return result.rows[0] || null;
};

export const updateApp = async (appId: number, userId: number, updates: Partial<App>): Promise<App> => {
  const fields = Object.keys(updates).map((key, i) => `${key}=$${i+1}`).join(', ');
  const values = Object.values(updates).concat([appId, userId]);
  
  const result = await pool.query(
    `UPDATE apps SET ${fields}, updated_at = NOW()
     WHERE id = $${Object.keys(updates).length + 1} AND user_id = $${Object.keys(updates).length + 2}
     RETURNING *`,
    values
  );
  return result.rows[0];
};

export const deleteApp = async (appId: number, userId: number): Promise<void> => {
  await pool.query(
    `DELETE FROM apps WHERE id = $1 AND user_id = $2`,
    [appId, userId]
  );
};
