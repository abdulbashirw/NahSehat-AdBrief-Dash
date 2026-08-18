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
import { startBlacklistSweep } from './models/tokenBlacklist';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import roleRoutes from './routes/roleRoutes';
import permissionRoutes from './routes/permissionRoutes';
import payorRoutes from './routes/payorRoutes';
import settingsRoutes from './routes/settingsRoutes';

const app = express();
const PORT = process.env.PORT || 3001;

/* ─── Global Middleware ─── */
app.use(helmet());
// CORS origins from env var (comma-separated), with localhost fallbacks for dev.
// Cloud Run: set CORS_ORIGIN to the frontend URL in env.cloud-run.yaml
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174,http://localhost:3000,http://localhost:3001')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());

/* ─── Health Check ─── */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/* ─── API Routes ─── */
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/roles', roleRoutes);
app.use('/api/v1/permissions', permissionRoutes);
app.use('/api/v1/payors', payorRoutes);
app.use('/api/v1/settings', settingsRoutes);

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
async function start() {
  try {
    await testConnection();
    // Start token blacklist periodic sweep
    startBlacklistSweep();
    app.listen(PORT, () => {
      console.log(`🚀 NahSeHat Dashboard API running on port ${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/health`);
      console.log(`   API:    http://localhost:${PORT}/api/v1`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

start();

export default app;