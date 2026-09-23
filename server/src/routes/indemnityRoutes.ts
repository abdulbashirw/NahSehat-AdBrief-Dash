/**
 * Indemnity proxy routes (P1c) — forwards whitelisted NahSehat API v3
 * endpoints with server-side JWT auth, payor scoping, and a service token
 * that never leaves this server. No arbitrary path forwarding.
 */
import { Router } from 'express';
import { proxyAdmDailyClaim } from '../controllers/proxyController';
import { authenticate, authorize } from '../middleware/auth';
import { proxyLimiter } from '../middleware/rateLimiter';
import { validateBody } from '../middleware/validate';
import { adBriefRequestSchema } from '../schemas';

const router = Router();

router.use(authenticate);

// Mirrors the frontend route guard for indemnity pages (defense in depth).
router.post(
  '/AdmDailyClaim',
  proxyLimiter,
  validateBody(adBriefRequestSchema),
  authorize('SUPER_ADMIN', 'ADMIN', 'INDEMNITY'),
  proxyAdmDailyClaim,
);

export default router;