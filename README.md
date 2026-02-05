Heroku Clone Platform (Backend + Nginx + UI)

A mini platform‑as‑a‑service backend that supports app creation, deployments, scaling, env vars, logs, and Nginx routing. It ships with a single‑file UI client for testing all endpoints.

**Features**
- Auth with JWT access tokens and refresh cookies
- App CRUD with ownership checks
- Deploy, stop, list containers
- Scale up, down, or set instances
- Env vars CRUD per app
- Logs and log streaming
- Nginx proxy config generation
- Docker Compose stack with Postgres and Redis

**Tech Stack**
- Node.js + Express + TypeScript
- Postgres, Redis
- Nginx
- Docker Compose
- Bulma + Alpine.js + Axios UI client

**Quick Start (Docker)**
1. Build and run:
   ```bash
   docker compose up --build
   ```
2. Backend runs on `http://localhost:3000`.
3. UI file is at `ui/index.html`.

**Environment Variables**
- `NODE_ENV`  
  `development` or `production`
- `DATABASE_URL`  
  Example: `postgresql://postgres:password@postgres:5432/heroku_clone`
- `REDIS_URL`  
  Example: `redis://redis:6379`
- `FRONTEND_URLS`  
  Comma‑separated list of allowed origins for CORS in production. Example:  
  `http://localhost:3001,http://localhost:5173`

**API Overview**
Base and Health:
- `GET /`  
- `GET /health`

Auth:
- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

Apps:
- `GET /apps`
- `POST /apps`
- `GET /apps/:id`
- `PUT /apps/:id`
- `DELETE /apps/:id`

Env Vars:
- `POST /apps/:id/env`
- `GET /apps/:id/env`
- `PUT /apps/:id/env/:key`
- `DELETE /apps/:id/env/:key`

Logs:
- `GET /apps/:id/logs`
- `GET /apps/:id/logs/stream`

Scaling:
- `POST /apps/:id/scale`
- `POST /apps/:id/scale/up`
- `POST /apps/:id/scale/down`
- `GET /apps/:id/scale`

Deployment:
- `POST /apps/:id/deploy`
- `POST /apps/:id/stop`
- `GET /apps/:id/containers`

Proxy:
- `POST /apps/:id/proxy`
- `GET /apps/:id/proxy/status`

**UI Client**
The UI is a single file at `ui/index.html`. It includes:
- Base URL selector
- Auth login to store token
- Forms for every endpoint
- JSON response viewer

If you open the UI via a local file server, ensure CORS allows the origin. For local dev, the backend is permissive when `NODE_ENV` is not `production`.

**Common Troubleshooting**
- `Cannot find module /app/dist/app.js`  
  The container volume was overriding `/app`. Mount only `./src` to `/app/src`.
- `Cannot find module 'cookie-parser'`  
  Do not mount an anonymous volume to `/app/node_modules`.
- CORS errors  
  Set `FRONTEND_URLS` for production or keep `NODE_ENV=development`.

**Notes**
This project is a learning‑oriented PaaS prototype. It is not hardened for production by default.
