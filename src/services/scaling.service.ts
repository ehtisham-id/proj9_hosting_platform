import { pool, redisClient } from '../config/database';

export interface ScalingPolicy {
  min: number;
  max: number;
  cpu_limit?: number;
  memory_limit?: string;
}

export const getInstanceCount = async (appId: number): Promise<number> => {
  const redisKey = `app:${appId}:instances`;
  let count = await redisClient.get(redisKey);
  
  if (count === null) {
    // Fallback to DB
    const result = await pool.query('SELECT instances FROM apps WHERE id = $1', [appId]);
    count = result.rows[0]?.instances?.toString() || '1';
    await redisClient.set(redisKey, count, { EX: 3600 }); // Cache 1h
  }
  
  return parseInt(count) || 1;
};

export const setInstanceCount = async (appId: number, count: number): Promise<number> => {
  const redisKey = `app:${appId}:instances`;
  
  // Get scaling policy
  const policyResult = await pool.query(
    'SELECT scaling_policy FROM apps WHERE id = $1',
    [appId]
  );
  const policy: ScalingPolicy = policyResult.rows[0]?.scaling_policy || { min: 1, max: 10 };
  
  // Enforce limits
  const finalCount = Math.max(policy.min, Math.min(policy.max, count));
  
  await redisClient.set(redisKey, finalCount.toString(), { EX: 3600 });
  await pool.query(
    'UPDATE apps SET instances = $1 WHERE id = $2',
    [finalCount, appId]
  );
  
  return finalCount;
};

export const scaleUp = async (appId: number, increment: number = 1): Promise<number> => {
  const current = await getInstanceCount(appId);
  return await setInstanceCount(appId, current + increment);
};

export const scaleDown = async (appId: number, decrement: number = 1): Promise<number> => {
  const current = await getInstanceCount(appId);
  return await setInstanceCount(appId, Math.max(1, current - decrement));
};

export const getScalingMetrics = async (appId: number) => {
  const count = await getInstanceCount(appId);
  const policyResult = await pool.query(
    'SELECT scaling_policy FROM apps WHERE id = $1',
    [appId]
  );
  const policy: ScalingPolicy = policyResult.rows[0]?.scaling_policy || { min: 1, max: 10 };
  
  // Simulate metrics
  const cpuUsage = (Math.random() * 80 + 20).toFixed(1);
  const memoryUsage = (Math.random() * 70 + 30).toFixed(1);
  
  return {
    instances: count,
    policy,
    metrics: {
      cpu: `${cpuUsage}%`,
      memory: `${memoryUsage}%`,
      requestsPerMin: Math.floor(Math.random() * 500 + 50)
    }
  };
};
