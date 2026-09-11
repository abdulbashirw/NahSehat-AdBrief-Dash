/**
 * App entry point — Express server with MySQL connection.
 *
 * Routes:
 *   /api/v1/auth/*       — Authentication (login, validate, logout)
 *   /api/v1/users/*      — User CRUD (CMS)
 *   /api/v1/roles/*      — Role CRUD (CMS)
 *   /api/v1/permissions/* — Permission management (CMS)
 *   /api/v1/payors/*     — Payor CRUD (CMS)
 *   /api/v1/settings/*   — App settings (CMS)
 *
 * Data from external services (Indemnity, ManageCare) is NOT stored here —
 * the frontend fetches directly from those APIs via RTK Query.
 */
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { testConnection } from './config/database';
import { corsConfig } from './config';
import { startBlacklistSweep } from './models/tokenBlacklist';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import roleRoutes from './routes/roleRoutes';
import permissionRoutes from './routes/permissionRoutes';
import payorRoutes from './routes/payorRoutes';
import settingsRoutes from './routes/settingsRoutes';
import activityRoutes from './routes/activityRoutes';
import { accessLogger } from './middleware/accessLogger';
import { startAggregationJob } from './jobs/aggregationJob';
import { globalLimiter } from './middleware/rateLimiter';

const app = express();
const PORT = process.env.PORT || 3001;

/* ─── Proxy trust (Cloud Run LB = 1 hop) ─────────────────────────────
 * SECURITY (P1.1): tanpa ini, req.ip = IP load balancer → rate limiter
 * per-IP akan salah mengelompokkan semua user sebagai satu IP.
 */
app.set('trust proxy', 1);

/* ─── Global Middleware ─── */
app.use(helmet());
// CORS — origins & Cloud Run auto-allow configured centrally in config/index.ts.
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no Origin header (curl, server-to-server, same-origin)
    if (!origin) return callback(null, true);
    if (corsConfig.origins.includes(origin)) return callback(null, true);
    if (corsConfig.allowCloudRun && /^https:\/\/[^/]+\.run\.app$/.test(origin)) return callback(null, true);
    // SECURITY (P2.6): reject silently — cors() turns an Error callback into a
    // 500 + stack in logs; a plain `false` yields a clean CORS-less response.
    return callback(null, false);
  },
  credentials: true,
}));
// SECURITY (P2.8): structured 'combined' format in production (less log
// forging surface, includes real IP + referer); pretty 'dev' only in dev.
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());

// Access logging — placed BEFORE route registrations so it runs on every
// API request. It registers a `res.on('finish')` listener that logs the
// access event after the response is sent (non-blocking, fire-and-forget).
app.use(accessLogger);

/* ─── Health Check ─── */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/* ─── API Routes ─── */
// SECURITY (P1.1): global rate limit untuk semua route /api
// (/health di luar /api sehingga tidak ikut ter-limit)
app.use('/api', globalLimiter);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/roles', roleRoutes);
app.use('/api/v1/permissions', permissionRoutes);
app.use('/api/v1/payors', payorRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/activity', activityRoutes);

/* ─── 404 Handler ─── */
app.use((_req, res) => {
  res.status(404).json({
    data: null,
    message: 'Route not found',
    statusCode: 404,
  });
});

/* ─── Error Handler ─── */
app.use(errorHandler);

/* ─── Start Server ─── */
const server = app.listen(PORT, () => {
  console.log(`🚀 NahSeHat Dashboard API running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   API:    http://localhost:${PORT}/api/v1`);
});

async function initializeServices() {
  while (true) {
    try {
      await testConnection();
      // Start token blacklist periodic sweep
      startBlacklistSweep();
      // Start activity aggregation job (runs every hour + once on startup)
      startAggregationJob();
      return;
    } catch (err) {
      console.error('Database is unavailable; retrying in 5 seconds', err);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

initializeServices();

export default app;