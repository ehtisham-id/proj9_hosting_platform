import { Router } from 'express';
import { 
  scaleHandler, scaleUpHandler, scaleDownHandler, metricsHandler 
} from '../controllers/scalingController';
import { authenticateJWT } from '../middleware/rbac';
import { generalRateLimit } from '../middleware/security';

export const scalingRouter = Router();

scalingRouter.use(authenticateJWT);
scalingRouter.use(generalRateLimit);

// Scaling endpoints
scalingRouter.post('/scale', scaleHandler);
scalingRouter.post('/scale/up', scaleUpHandler);
scalingRouter.post('/scale/down', scaleDownHandler);
scalingRouter.get('/scale', metricsHandler);

export default scalingRouter;
