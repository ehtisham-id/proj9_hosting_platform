import { Router } from 'express';
import { generateProxyHandler, proxyStatusHandler } from '../controllers/proxyController';
import { authenticateJWT } from '../middleware/rbac';
import { generalRateLimit } from '../middleware/security';

export const proxyRouter = Router();

proxyRouter.use(authenticateJWT);
proxyRouter.use(generalRateLimit);

proxyRouter.post('/proxy', generateProxyHandler);
proxyRouter.get('/proxy', proxyStatusHandler);

export default proxyRouter;
