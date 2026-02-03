import { Router } from 'express';
import { signup, login, refresh, logout } from '../controllers/authController';

export const authRouter = Router();

authRouter.post('/signup', signup);
authRouter.post('/login', login);
authRouter.post('/refresh', refresh);
authRouter.post('/logout', logout);


import { authRouter } from './auth';
import { loginRateLimit } from '../middleware/security';

authRouter.post('/signup', generalRateLimit, signup);
authRouter.post('/login', loginRateLimit, login);  // Strict rate limiting
authRouter.post('/refresh', generalRateLimit, refresh);
authRouter.post('/logout', generalRateLimit, logout);
