/**
 * Activity routes — User Activity & Access Logs dashboard.
 *
 * All endpoints require authentication.
 * Summary/charts/logs are available to SUPER_ADMIN and ADMIN.
 * Aggregation trigger is SUPER_ADMIN only.
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

const router = Router();

router.use(authenticate);

// Dashboard data — SUPER_ADMIN + ADMIN
router.get('/summary', authorize('SUPER_ADMIN', 'ADMIN'), getSummary);
router.get('/users', authorize('SUPER_ADMIN', 'ADMIN'), getUsers);
router.get('/trend', authorize('SUPER_ADMIN', 'ADMIN'), getTrendData);
router.get('/modules', authorize('SUPER_ADMIN', 'ADMIN'), getModules);
router.get('/heatmap', authorize('SUPER_ADMIN', 'ADMIN'), getHeatmapData);
router.get('/logs', authorize('SUPER_ADMIN', 'ADMIN'), getLogs);
router.get('/sessions', authorize('SUPER_ADMIN', 'ADMIN'), getSessions);

// Aggregation trigger — SUPER_ADMIN only
router.post('/aggregate', authorize('SUPER_ADMIN'), triggerAggregation);

// Client-side page view logging — any authenticated user
// Used for modules (Indemnity, ManageCare) whose data comes from external APIs
router.post('/log', logPageView);

export default router;