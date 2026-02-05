import { Router } from 'express';
import { authenticateJWT, requireRole, requireAppOwnership } from '../middleware/rbac.middleware';
import { generalRateLimit } from '../middleware/security.middleware';
import { 
  createAppHandler, listAppsHandler, getAppHandler, 
  updateAppHandler, deleteAppHandler 
} from '../controllers/app.controller';
import envRouter from './env.route';
import logsRouter from './logs.route';
import scalingRouter from './scaling.route';
import deploymentRouter from './deployment.route';
import proxyRouter from './proxy.route';
import {auditTrail} from "../middleware/securityAudit.middleware";

export const appsRouter = Router();

appsRouter.use(authenticateJWT);
appsRouter.use(generalRateLimit);
appsRouter.use(auditTrail);

// List apps (user's own apps only)
appsRouter.get('/', listAppsHandler);

// CRUD operations with ownership checks
appsRouter.post('/', requireRole(['user', 'admin']), createAppHandler);

appsRouter.route('/:id')
  .get(getAppHandler)
  .put(requireAppOwnership, updateAppHandler)
  .delete(requireAppOwnership, deleteAppHandler);




// Mount env routes under each app
appsRouter.use('/:id/env', envRouter);

// Mount logs under each app
appsRouter.use('/:id/logs', logsRouter);


// Mount scaling under each app
appsRouter.use('/:id/scale', scalingRouter);


// Deployment endpoints under app
appsRouter.use('/:id', deploymentRouter);

// Mount proxy routes
appsRouter.use('/:id/proxy', proxyRouter);

export default appsRouter;
