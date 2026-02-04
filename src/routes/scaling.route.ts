import { Router } from 'express';
import { 
  scaleHandler, scaleUpHandler, scaleDownHandler, metricsHandler 
} from '../controllers/scaling.controller';
import { authenticateJWT } from '../middleware/rbac.middleware';
import { generalRateLimit } from '../middleware/security.middleware';

export const scalingRouter = Router();

scalingRouter.use(authenticateJWT);
scalingRouter.use(generalRateLimit);

// Scaling endpoints
scalingRouter.post('/scale', scaleHandler);
scalingRouter.post('/scale/up', scaleUpHandler);
scalingRouter.post('/scale/down', scaleDownHandler);
scalingRouter.get('/scale', metricsHandler);

export default scalingRouter;
