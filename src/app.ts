import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { healthCheckRouter } from "./routes/health.route";
import { appsRouter } from "./routes/index.route";
import { initDb } from "./config/database.config";
import {
  generalRateLimit,
  ipBlacklist,
} from "./middleware/security.middleware";
import authRouter from "./routes/auth.route";

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Initialize DB on startup
initDb().catch(console.error);

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }),
);

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    credentials: true,
  }),
);
app.use(morgan("combined"));
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Health check route
app.use("/health", healthCheckRouter);
app.use("/auth", authRouter);

// Add middleware globally (except auth)
app.use(generalRateLimit);
app.use(ipBlacklist);

app.use("/apps", appsRouter);

app.get("/", (req, res) => {
  res.json({ message: "Heroku Clone API v1.0 - Phase 0 Complete" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export default app;
