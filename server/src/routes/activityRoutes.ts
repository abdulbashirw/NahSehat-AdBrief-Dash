/**
 * Activity routes — User Activity & Access Logs dashboard.
 *
 * All endpoints require authentication.
 * Summary/charts/logs are available to SUPER_ADMIN and ADMIN.
 * Aggregation trigger is SUPER_ADMIN only.
 *
 * SECURITY (P2.7): POST /log di-rate-limit per-user (log flooding guard).
 * SECURITY (P2.2): body & query divalidasi zod + pagination clamped.
 */
import { Router } from 'express';
import {
  getSummary,
  getUsers,
  getTrendData,
  getModules,
  getHeatmapData,
  getLogs,
  getSessions,
  triggerAggregation,
  logPageView,
} from '../controllers/activityController';
import { authenticate, authorize } from '../middleware/auth';
import { logLimiter } from '../middleware/rateLimiter';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  logPageViewSchema,
  aggregateSchema,
  activityQuerySchema,
  activityLogsQuerySchema,
  trendQuerySchema,
} from '../schemas';

const router = Router();

router.use(authenticate);

// Dashboard data — SUPER_ADMIN + ADMIN
router.get('/summary', validateQuery(trendQuerySchema), authorize('SUPER_ADMIN', 'ADMIN'), getSummary);
router.get('/users', validateQuery(activityQuerySchema), authorize('SUPER_ADMIN', 'ADMIN'), getUsers);
router.get('/trend', validateQuery(trendQuerySchema), authorize('SUPER_ADMIN', 'ADMIN'), getTrendData);
router.get('/modules', validateQuery(trendQuerySchema), authorize('SUPER_ADMIN', 'ADMIN'), getModules);
router.get('/heatmap', validateQuery(trendQuerySchema), authorize('SUPER_ADMIN', 'ADMIN'), getHeatmapData);
router.get('/logs', validateQuery(activityLogsQuerySchema), authorize('SUPER_ADMIN', 'ADMIN'), getLogs);
router.get('/sessions', validateQuery(activityLogsQuerySchema), authorize('SUPER_ADMIN', 'ADMIN'), getSessions);

// Aggregation trigger — SUPER_ADMIN only
router.post('/aggregate', validateBody(aggregateSchema), authorize('SUPER_ADMIN'), triggerAggregation);

// Client-side page view logging — any authenticated user
// Used for modules (Indemnity, ManageCare) whose data comes from external APIs
// SECURITY (P2.7): rate limit per-user + (P2.2) strict body schema
router.post('/log', logLimiter, validateBody(logPageViewSchema), logPageView);

export default router;