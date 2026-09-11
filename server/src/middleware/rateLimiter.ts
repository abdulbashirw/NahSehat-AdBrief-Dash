/**
 * Rate limiters — express-rate-limit (P1.1).
 *
 * Lapisan pertahanan brute-force / resource-abuse:
 *   - globalLimiter : semua route /api — 300 req / 15 menit / IP
 *   - loginLimiter  : /auth/login & /auth/verify-2fa-login — 10 req / 15 menit / IP
 *
 * NOTE: Cloud Run berada di belakang 1 hop proxy (LB) — app.ts mem-set
 * `trust proxy = 1` agar req.ip = IP client asli, bukan IP load balancer.
 */
import rateLimit from 'express-rate-limit';

const standardMessage = {
  data: null,
  message: 'Too many requests, please try again later',
  statusCode: 429,
};

/** Global limiter — applies to all /api routes. */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: standardMessage,
});

/** Strict limiter for authentication endpoints (brute-force defense). */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    data: null,
    message: 'Too many login attempts from this IP, please try again later',
    statusCode: 429,
  },
});

/**
 * Client page-view logging limiter (P2.7 — log flooding guard).
 * Keyed by user id (NOT IP) so a shared office IP doesn't throttle legit
 * users; runs AFTER authenticate, so req.user is available.
 */
export const logLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => (req as { user?: { id?: string } }).user?.id ?? req.ip ?? 'anonymous',
  message: {
    data: null,
    message: 'Too many log requests, please slow down',
    statusCode: 429,
  },
});