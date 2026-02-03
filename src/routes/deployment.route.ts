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
