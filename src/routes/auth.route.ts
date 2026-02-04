import { Router } from 'express';
import { signup, login, refresh, logout } from '../controllers/auth.controller';
import { generalRateLimit } from '../middleware/security.middleware';

export const authRouter = Router();

authRouter.post('/signup', generalRateLimit, signup);
authRouter.post('/login', generalRateLimit, login);  // Strict rate limiting
authRouter.post('/refresh', generalRateLimit, refresh);
authRouter.post('/logout', generalRateLimit, logout);

export default authRouter;