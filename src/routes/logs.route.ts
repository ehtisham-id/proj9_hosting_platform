import { Router } from 'express';
import { getLogsHandler, streamLogsHandler } from '../controllers/log.controller';
import { authenticateJWT } from '../middleware/rbac.middleware';
import { generalRateLimit } from '../middleware/security.middleware';

export const logsRouter = Router();

logsRouter.use(authenticateJWT);
logsRouter.use(generalRateLimit);

logsRouter.get('/logs', getLogsHandler);
logsRouter.get('/logs/stream', streamLogsHandler);

export default logsRouter;
