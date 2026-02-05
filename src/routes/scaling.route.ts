import { Router } from 'express';
import { 
  scaleHandler, scaleUpHandler, scaleDownHandler, metricsHandler 
} from '../controllers/scaling.controller';
import { authenticateJWT } from '../middleware/rbac.middleware';
import { generalRateLimit } from '../middleware/security.middleware';

export const scalingRouter = Router({ mergeParams: true });

scalingRouter.use(authenticateJWT);
scalingRouter.use(generalRateLimit);

// Scaling endpoints
scalingRouter.post('/', scaleHandler);
scalingRouter.post('/up', scaleUpHandler);
scalingRouter.post('/down', scaleDownHandler);
scalingRouter.get('/', metricsHandler);

export default scalingRouter;
