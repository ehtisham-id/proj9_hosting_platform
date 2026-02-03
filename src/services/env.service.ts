import { pool } from '../config/database';

export interface EnvVar {
  id: number;
  app_id: number;
  key: string;
  value: string;
  created_at: Date;
}

export const createEnvVar = async (appId: number, key: string, value: string): Promise<EnvVar> => {
  const result = await pool.query(
    `INSERT INTO app_env (app_id, key, value) 
     VALUES ($1, $2, $3) 
     RETURNING *`,
    [appId, key, value]
  );
  return result.rows[0];
};

export const getAppEnvVars = async (appId: number): Promise<EnvVar[]> => {
  const result = await pool.query(
    `SELECT id, app_id, key, value, created_at 
     FROM app_env WHERE app_id = $1 ORDER BY created_at DESC`,
    [appId]
  );
  return result.rows;
};

export const updateEnvVar = async (appId: number, key: string, value: string): Promise<EnvVar | null> => {
  const result = await pool.query(
    `UPDATE app_env 
     SET value = $1, updated_at = NOW()
     WHERE app_id = $2 AND key = $3
     RETURNING *`,
    [value, appId, key]
  );
  return result.rows[0] || null;
};

export const deleteEnvVar = async (appId: number, key: string): Promise<void> => {
  await pool.query(
    `DELETE FROM app_env WHERE app_id = $1 AND key = $2`,
    [appId, key]
  );
};

export const deleteAllAppEnvVars = async (appId: number): Promise<void> => {
  await pool.query(`DELETE FROM app_env WHERE app_id = $1`, [appId]);
};
