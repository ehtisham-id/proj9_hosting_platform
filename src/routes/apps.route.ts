import { Router } from 'express';
import { authenticateJWT, requireRole, AuthRequest } from '../middleware/rbac';
import { pool } from '../config/database';
import { generalRateLimit } from '../middleware/security';

export const appsRouter = Router();

appsRouter.use(authenticateJWT);
appsRouter.use(generalRateLimit);

// Protected endpoints
appsRouter.get('/', async (req: AuthRequest, res) => {
  const apps = await pool.query(
    'SELECT id, name, created_at FROM apps WHERE user_id = $1',
    [req.user!.userId]
  );
  res.json(apps.rows);
});

appsRouter.post('/', requireRole(['user', 'admin']), async (req: AuthRequest, res) => {
  const { name } = req.body;
  const result = await pool.query(
    'INSERT INTO apps (name, user_id) VALUES ($1, $2) RETURNING *',
    [name, req.user!.userId]
  );
  res.status(201).json(result.rows[0]);
});


import { Router } from 'express';
import { 
  createAppHandler, listAppsHandler, getAppHandler, 
  updateAppHandler, deleteAppHandler 
} from '../controllers/appController';
import { authenticateJWT, requireAppOwnership } from '../middleware/rbac';
import { generalRateLimit } from '../middleware/security';

export const appsRouter = Router();

// Authentication required for all app routes
appsRouter.use(authenticateJWT);
appsRouter.use(generalRateLimit);

// List apps (user's own apps only)
appsRouter.get('/', listAppsHandler);

// CRUD operations with ownership checks
appsRouter.post('/', createAppHandler);

appsRouter.route('/:id')
  .get(getAppHandler)
  .put(requireAppOwnership, updateAppHandler)
  .delete(requireAppOwnership, deleteAppHandler);

export default appsRouter;


import envRouter from './env';

// Mount env routes under each app
appsRouter.use('/:id/env', envRouter);

import logsRouter from './logs';

// Mount logs under each app
appsRouter.use('/:id', (req, res, next) => {
  req.appId = parseInt(req.params.id); // Store for sub-routes
  next();
}, logsRouter);

import scalingRouter from './scaling';

// Mount scaling under each app
appsRouter.use('/:id/scale', scalingRouter);

import { Router } from 'express';
import { deployHandler, stopHandler, containersHandler } from '../controllers/deploymentController';
import { authenticateJWT } from '../middleware/rbac';
import { generalRateLimit } from '../middleware/security';

export const deploymentRouter = Router();

deploymentRouter.use(authenticateJWT);
deploymentRouter.use(generalRateLimit);

deploymentRouter.post('/deploy', deployHandler);
deploymentRouter.post('/stop', stopHandler);
deploymentRouter.get('/containers', containersHandler);

export default deploymentRouter;

import proxyRouter from './proxy';

// Mount proxy routes
appsRouter.use('/:id/proxy', proxyRouter);
// Apply to all routes
app.use(auditTrail);