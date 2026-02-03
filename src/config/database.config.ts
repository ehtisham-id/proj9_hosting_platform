import { Pool } from 'pg';
import Redis from 'redis';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export const redisClient = Redis.createClient({
  url: process.env.REDIS_URL
});

redisClient.connect().catch(console.error);

// Phase 1: Users table
export const initDb = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
    
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
};

// Add to existing initDb function
await pool.query(`
  -- Add role to users table
  ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';
  
  -- Create apps table for preview
  CREATE TABLE IF NOT EXISTS apps (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
  );
`);


await pool.query(`
  -- Enhanced apps table
  ALTER TABLE apps ADD COLUMN IF NOT EXISTS git_url VARCHAR(500);
  ALTER TABLE apps ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'stopped';
  ALTER TABLE apps ADD COLUMN IF NOT EXISTS instances INTEGER DEFAULT 1;
  ALTER TABLE apps ADD COLUMN IF NOT EXISTS last_deployed TIMESTAMP;
  
  -- Environment variables table
  CREATE TABLE IF NOT EXISTS app_env (
    id SERIAL PRIMARY KEY,
    app_id INTEGER REFERENCES apps(id) ON DELETE CASCADE,
    key VARCHAR(100) NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(app_id, key)
  );
`);


await pool.query(`
  CREATE TABLE IF NOT EXISTS app_logs (
    id BIGSERIAL PRIMARY KEY,
    app_id INTEGER REFERENCES apps(id) ON DELETE CASCADE,
    log_type VARCHAR(10) NOT NULL CHECK (log_type IN ('stdout', 'stderr')),
    message TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW(),
    instance_id VARCHAR(50)
  );
  
  CREATE INDEX IF NOT EXISTS idx_app_logs_app_id ON app_logs(app_id);
  CREATE INDEX IF NOT EXISTS idx_app_logs_timestamp ON app_logs(app_id, timestamp DESC);
`);

await pool.query(`
  -- Add scaling metadata to apps
  ALTER TABLE apps ADD COLUMN IF NOT EXISTS scaling_policy JSONB DEFAULT '{"min":1,"max":10}';
`);
