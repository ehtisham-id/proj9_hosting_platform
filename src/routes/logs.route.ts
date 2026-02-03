import { Router } from 'express';
import { getLogsHandler, streamLogsHandler } from '../controllers/logController';
import { authenticateJWT } from '../middleware/rbac';
import { generalRateLimit } from '../middleware/security';

export const logsRouter = Router();

logsRouter.use(authenticateJWT);
logsRouter.use(generalRateLimit);

logsRouter.get('/logs', getLogsHandler);
logsRouter.get('/logs/stream', streamLogsHandler);

export default logsRouter;
