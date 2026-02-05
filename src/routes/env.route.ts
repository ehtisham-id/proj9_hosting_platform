import { Router } from 'express';
import { 
  createEnvHandler, listEnvHandler, updateEnvHandler, deleteEnvHandler 
} from '../controllers/env.controller';
import { authenticateJWT } from '../middleware/rbac.middleware';
import { generalRateLimit } from '../middleware/security.middleware';

export const envRouter = Router({ mergeParams: true });

// Authentication required
envRouter.use(authenticateJWT);
envRouter.use(generalRateLimit);

// All routes: /apps/:id/env/*
envRouter.post('/', createEnvHandler);
envRouter.get('/', listEnvHandler);
envRouter.put('/:key', updateEnvHandler);
envRouter.delete('/:key', deleteEnvHandler);

export default envRouter;
