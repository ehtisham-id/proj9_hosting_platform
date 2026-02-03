import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { healthCheckRouter } from './routes/health.route';

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check route
app.use('/health', healthCheckRouter);

app.get('/', (req, res) => {
  res.json({ message: 'Heroku Clone API v1.0 - Phase 0 Complete' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export default app;


// Add to imports
import { authRouter } from './routes/auth';
import { initDb } from './config/database';

// Add before app.listen
app.use('/auth', authRouter);

// Initialize DB on startup
initDb().catch(console.error);


import { appsRouter } from './routes/apps';
import { loginRateLimit, generalRateLimit, ipBlacklist } from './middleware/security';

// Add middleware globally (except auth)
app.use(generalRateLimit);
app.use(ipBlacklist);

app.use('/apps', appsRouter);
app.use('/auth', authRouter);

// Replace previous appsRouter import with:
import appsRouter from './routes/apps';

// Ensure appsRouter is mounted
app.use('/apps', appsRouter);

import helmet from 'helmet';
import { sanitizeInput, authRateLimit, appRateLimit, validateJWT } from './middleware/advancedSecurity';

// Enhanced security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Global middleware stack
app.use(sanitizeInput);
app.use('/auth/*', authRateLimit);
app.use('/apps/*', appRateLimit);

// Apply to all protected routes
app.use('/apps', validateJWT);
