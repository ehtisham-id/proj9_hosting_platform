import { z } from 'zod';

export const userSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(100)
});

export const appSchema = z.object({
  name: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  git_url: z.string().url().optional()
});

export const envVarSchema = z.object({
  key: z.string().min(1).max(100).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
  value: z.string().max(5000)
});

export const scaleSchema = z.object({
  instances: z.number().min(1).max(20)
});

export const deploySchema = z.object({
  instances: z.number().min(1).max(10).optional(),
  env_vars: z.record(z.string(), z.string()).optional()
});
