import { Router } from 'express';
import { 
  createEnvHandler, listEnvHandler, updateEnvHandler, deleteEnvHandler 
} from '../controllers/envController';
import { authenticateJWT } from '../middleware/rbac';
import { generalRateLimit } from '../middleware/security';

export const envRouter = Router();

// Authentication required
envRouter.use(authenticateJWT);
envRouter.use(generalRateLimit);

// All routes: /apps/:id/env/*
envRouter.post('/', createEnvHandler);
envRouter.get('/', listEnvHandler);
envRouter.put('/:key', updateEnvHandler);
envRouter.delete('/:key', deleteEnvHandler);

export default envRouter;
