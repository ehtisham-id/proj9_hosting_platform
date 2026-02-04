import { Router } from 'express';
import { authenticateJWT, requireRole, AuthRequest } from '../middleware/rbac.middleware';
import { pool } from '../config/database.config';
import { generalRateLimit } from '../middleware/security.middleware';
import { 
  createAppHandler, listAppsHandler, getAppHandler, 
  updateAppHandler, deleteAppHandler 
} from '../controllers/app.controller';
import envRouter from './env.route';
import logsRouter from './logs.route';
import scalingRouter from './scaling.route';
import { deployHandler, stopHandler, containersHandler } from '../controllers/deployment.controller';
import proxyRouter from './proxy.route';
import {auditTrail} from "../middleware/securityAudit.middleware";

export const appsRouter = Router();

appsRouter.use(authenticateJWT);
appsRouter.use(generalRateLimit);
appsRouter.use(auditTrail);


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


// List apps (user's own apps only)
appsRouter.get('/', listAppsHandler);

// CRUD operations with ownership checks
appsRouter.post('/', createAppHandler);

// middleware to ensure the authenticated user owns the app or is admin
async function requireAppOwnership(req: AuthRequest, res: any, next: any) {
  const appId = parseInt(req.params.id, 10);
  if (isNaN(appId)) return res.status(400).json({ message: 'Invalid app id' });

  const result = await pool.query(
    'SELECT user_id FROM apps WHERE id = $1',
    [appId]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ message: 'App not found' });
  }

  const ownerId = result.rows[0].user_id;
  if (ownerId !== req.user!.userId && req.user!.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  next();
}

appsRouter.route('/:id')
  .get(getAppHandler)
  .put(requireAppOwnership, updateAppHandler)
  .delete(requireAppOwnership, deleteAppHandler);




// Mount env routes under each app
appsRouter.use('/:id/env', envRouter);

// Mount logs under each app
appsRouter.use('/:id', (req: AuthRequest & { appId?: number }, res: any, next: any) => {
  req.appId = parseInt(req.params.id); // Store for sub-routes
  next();
}, logsRouter);


// Mount scaling under each app
appsRouter.use('/:id/scale', scalingRouter);


appsRouter.post('/deploy', deployHandler);
appsRouter.post('/stop', stopHandler);
appsRouter.get('/containers', containersHandler);

// Mount proxy routes
appsRouter.use('/:id/proxy', proxyRouter);

export default appsRouter;