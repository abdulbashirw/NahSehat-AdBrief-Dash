/**
 * Access Logger Middleware — auto-logs every API request to access_logs.
 *
 * Placed after `authenticate` so req.user is available for authenticated
 * requests.  Skips logging for:
 *   - GET /api/v1/activity/* (avoid recursive logging of dashboard queries)
 *   - Static file requests
 *   - Health check endpoints
 *
 * Uses res.on('finish') to capture status code and response time.
 */
import type { Request, Response, NextFunction } from 'express';
import { logAccessEvent } from '../models/activityModel';
import type { AuthRequest } from './auth';

/* ── Module mapping: route prefix → module name ── */
const MODULE_MAP: Record<string, string> = {
  '/api/v1/indemnity': 'indemnity',
  '/api/v1/managecare': 'managecare',
  '/api/v1/payors': 'cms',
  '/api/v1/users': 'cms',
  '/api/v1/roles': 'cms',
  '/api/v1/permissions': 'cms',
  '/api/v1/settings': 'settings',
  '/api/v1/auth': 'auth',
  // Dashboard requests go through this backend (e.g. /health, settings/public)
  // but dashboard page views are logged client-side via usePageViewLogger
};

/* ── Paths that should NOT be logged ── */
const SKIP_PATHS = [
  '/api/v1/activity/', // don't log the activity dashboard's own queries
  '/health',
  '/api/health',
];

function shouldSkip(path: string): boolean {
  return SKIP_PATHS.some((p) => path.startsWith(p));
}

function resolveModule(path: string): string | null {
  for (const [prefix, module] of Object.entries(MODULE_MAP)) {
    if (path.startsWith(prefix)) return module;
  }
  return null;
}

function resolveMenuLabel(path: string): string | null {
  // Simple mapping based on known routes
  if (path.includes('/overview')) return 'Utilization Overview';
  if (path.includes('/claims-map')) return 'Claims Map';
  if (path.includes('/demographics')) return 'Demographics';
  if (path.includes('/diseases')) return 'Diseases';
  if (path.includes('/daily-monitoring') || path.includes('/dailyMonitoring')) return 'Daily Monitoring';
  if (path.includes('/users')) return 'User Management';
  if (path.includes('/roles')) return 'Role Management';
  if (path.includes('/payors')) return 'Payor Management';
  if (path.includes('/permissions')) return 'Permissions';
  if (path.includes('/settings')) return 'Settings';
  if (path.includes('/login')) return 'Login';
  if (path.includes('/logout')) return 'Logout';
  return null;
}

function resolveMenuPath(originalUrl: string): string | null {
  // Strip query string, keep just the path
  const idx = originalUrl.indexOf('?');
  return idx >= 0 ? originalUrl.substring(0, idx) : originalUrl;
}

function resolveActionType(method: string, path: string): string {
  if (path.includes('/login')) return 'login';
  if (path.includes('/logout')) return 'logout';
  if (method === 'GET') return 'page_view';
  if (method === 'POST' && path.includes('/export')) return 'export';
  if (method === 'POST') return 'api_call';
  if (method === 'PUT' || method === 'PATCH') return 'api_call';
  if (method === 'DELETE') return 'api_call';
  return 'api_call';
}

/**
 * Access logger middleware.
 * Must be placed AFTER `authenticate` in the middleware chain.
 */
export function accessLogger(req: Request, res: Response, next: NextFunction): void {
  // Skip non-API requests and activity dashboard's own queries
  if (!req.path.startsWith('/api/') || shouldSkip(req.path)) {
    return next();
  }

  const startTime = Date.now();
  // Capture the ORIGINAL path NOW — Express routers modify req.path/req.url
  // to be relative to their mount point, so by the time `finish` fires,
  // req.path would be "/login" instead of "/api/v1/auth/login".
  const originalPath = req.path;
  const originalUrl = req.originalUrl;

  // Log after response is finished
  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const authReq = req as AuthRequest;
    const user = authReq.user;

    // Fire-and-forget — don't block the response
    logAccessEvent({
      userId: user?.id ?? null,
      username: user?.username ?? null,
      fullName: null, // AuthRequest.user only has id/username/role from JWT
      role: user?.role ?? null,
      actionType: resolveActionType(req.method, originalPath),
      menuPath: resolveMenuPath(originalUrl),
      menuLabel: resolveMenuLabel(originalPath),
      module: resolveModule(originalPath),
      method: req.method,
      endpoint: originalUrl,
      ipAddress: req.ip ?? req.socket.remoteAddress ?? null,
      userAgent: req.get('user-agent') ?? null,
      statusCode: res.statusCode,
      durationMs,
      sessionId: null, // session_id is set during login, stored in req by auth middleware if needed
    }).catch((err) => {
      // Silent fail — logging should never break the request
      console.error('[accessLogger] Failed to log access event');
    });
  });

  next();
}