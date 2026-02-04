import { Router } from 'express';
import { generateProxyHandler, proxyStatusHandler } from '../controllers/proxy.controller';
import { authenticateJWT } from '../middleware/rbac.middleware';
import { generalRateLimit } from '../middleware/security.middleware';

export const proxyRouter = Router();

proxyRouter.use(authenticateJWT);
proxyRouter.use(generalRateLimit);

proxyRouter.post('/proxy', generateProxyHandler);
proxyRouter.get('/proxy', proxyStatusHandler);

export default proxyRouter;
