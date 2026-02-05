import { Router } from 'express';
import { getLogsHandler, streamLogsHandler } from '../controllers/log.controller';
import { authenticateJWT } from '../middleware/rbac.middleware';
import { generalRateLimit } from '../middleware/security.middleware';

export const logsRouter = Router({ mergeParams: true });

logsRouter.use(authenticateJWT);
logsRouter.use(generalRateLimit);

logsRouter.get('/', getLogsHandler);
logsRouter.get('/stream', streamLogsHandler);

export default logsRouter;
