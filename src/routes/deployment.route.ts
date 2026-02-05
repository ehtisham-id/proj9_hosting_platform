import { Router } from 'express';
import { deployHandler, stopHandler, containersHandler } from '../controllers/deployment.controller';
import { authenticateJWT } from '../middleware/rbac.middleware';
import { generalRateLimit } from '../middleware/security.middleware';

export const deploymentRouter = Router({ mergeParams: true });

deploymentRouter.use(authenticateJWT);
deploymentRouter.use(generalRateLimit);

deploymentRouter.post('/deploy', deployHandler);
deploymentRouter.post('/stop', stopHandler);
deploymentRouter.get('/containers', containersHandler);

export default deploymentRouter;
