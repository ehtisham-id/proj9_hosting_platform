import { Router } from 'express';
import { signup, login, refresh, logout } from '../controllers/auth.controller';
import { generalRateLimit, loginRateLimit } from '../middleware/security.middleware';

export const authRouter = Router();

authRouter.post('/signup', generalRateLimit, signup);
authRouter.post('/login', loginRateLimit, login);
authRouter.post('/refresh', generalRateLimit, refresh);
authRouter.post('/logout', generalRateLimit, logout);

export default authRouter;
