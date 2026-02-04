import { Router } from 'express';

export const healthCheckRouter = Router();

healthCheckRouter.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    phase: '0 - Scaffolding Complete'
  });
});

export default healthCheckRouter;