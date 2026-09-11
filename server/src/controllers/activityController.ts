/**
 * Activity Controller — 8 endpoints for the User Activity dashboard.
 *
 * Endpoints:
 *   GET  /api/v1/activity/summary     — 6 KPI metrics
 *   GET  /api/v1/activity/users       — detailed user table (paginated, search, filter)
 *   GET  /api/v1/activity/trend       — daily trend chart data
 *   GET  /api/v1/activity/modules     — module distribution donut chart
 *   GET  /api/v1/activity/heatmap     — hourly heatmap data
 *   GET  /api/v1/activity/logs        — raw access logs (paginated)
 *   GET  /api/v1/activity/sessions    — login sessions (paginated)
 *   POST /api/v1/activity/aggregate   — trigger daily aggregation (admin only)
 *   POST /api/v1/activity/log         — client-side page view logging (any user)
 */
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth';
import {
  getActivitySummary,
  getDetailedUsers,
  getTrend,
  getModuleStats,
  getHeatmap,
  getAccessLogs,
  getLoginSessions,
  runAggregation,
  logAccessEvent,
} from '../models/activityModel';
import type { AggregationResult } from '../models/activityModel';
import type { PaginatedResponse } from '../types';

/* ── Helper: clamp pagination (P2.7 — resource consumption guard) ── */
function clampPagination(rawPage: unknown, rawPageSize: unknown, defaultPageSize: number): { page: number; pageSize: number } {
  const page = Math.max(Math.floor(Number(rawPage) || 1), 1);
  const pageSize = Math.min(Math.max(Math.floor(Number(rawPageSize) || defaultPageSize), 1), 100);
  return { page, pageSize };
}

/* ── Helper: resolve date range from query params ── */

function resolveDateRange(query: any): { startDate: string; endDate: string } {
  // SECURITY (P2.7): clamp days — query range besar = beban DB berlebih.
  const days = Math.min(Math.max(Number(query.days) || 30, 1), 365);
  const now = new Date();
  const past = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  return { startDate: fmt(past), endDate: fmt(now) };
}

/* ─────────────────────────────────────────────────────────────────
 *  1. GET /api/v1/activity/summary
 * ─────────────────────────────────────────────────────────────── */

export async function getSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { startDate, endDate } = resolveDateRange(req.query);
    const summary = await getActivitySummary(startDate, endDate);
    res.json(summary);
  } catch (err) { next(err); }
}

/* ───────────────────────────────────────────────────────────────
 *  2. GET /api/v1/activity/users
 * ─────────────────────────────────────────────────────────────── */

export async function getUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { startDate, endDate } = resolveDateRange(req.query);
    const raw = req.query as any;
    const { page, pageSize } = clampPagination(raw.page, raw.pageSize, 10);

    const result = await getDetailedUsers({
      startDate,
      endDate,
      search: String(raw.search ?? ''),
      status: String(raw.status ?? 'ALL'),
      activityLevel: String(raw.activityLevel ?? 'ALL'),
      analyticsCategory: String(raw.analyticsCategory ?? 'ALL'),
      page,
      pageSize,
    });

    const response: PaginatedResponse<typeof result.data[0]> = {
      data: result.data,
      total: result.total,
      page,
      pageSize,
      totalPages: Math.ceil(result.total / pageSize) || 1,
    };
    res.json(response);
  } catch (err) { next(err); }
}

/* ───────────────────────────────────────────────────────────────
 *  3. GET /api/v1/activity/trend
 * ─────────────────────────────────────────────────────────────── */

export async function getTrendData(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { startDate, endDate } = resolveDateRange(req.query);
    const trend = await getTrend(startDate, endDate);
    res.json({ data: trend });
  } catch (err) { next(err); }
}

/* ───────────────────────────────────────────────────────────────
 *  4. GET /api/v1/activity/modules
 * ─────────────────────────────────────────────────────────────── */

export async function getModules(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { startDate, endDate } = resolveDateRange(req.query);
    const modules = await getModuleStats(startDate, endDate);
    res.json({ data: modules });
  } catch (err) { next(err); }
}

/* ───────────────────────────────────────────────────────────────
 *  5. GET /api/v1/activity/heatmap
 * ─────────────────────────────────────────────────────────────── */

export async function getHeatmapData(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { startDate, endDate } = resolveDateRange(req.query);
    const heatmap = await getHeatmap(startDate, endDate);
    res.json({ data: heatmap });
  } catch (err) { next(err); }
}

/* ───────────────────────────────────────────────────────────────
 *  6. GET /api/v1/activity/logs
 * ─────────────────────────────────────────────────────────────── */

export async function getLogs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { startDate, endDate } = resolveDateRange(req.query);
    const raw = req.query as any;
    const { page, pageSize } = clampPagination(raw.page, raw.pageSize, 20);

    const result = await getAccessLogs({
      startDate,
      endDate,
      search: String(raw.search ?? ''),
      page,
      pageSize,
    });

    const response: PaginatedResponse<typeof result.data[0]> = {
      data: result.data,
      total: result.total,
      page,
      pageSize,
      totalPages: Math.ceil(result.total / pageSize) || 1,
    };
    res.json(response);
  } catch (err) { next(err); }
}

/* ───────────────────────────────────────────────────────────────
 *  7. GET /api/v1/activity/sessions
 * ─────────────────────────────────────────────────────────────── */

export async function getSessions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { startDate, endDate } = resolveDateRange(req.query);
    const raw = req.query as any;
    const { page, pageSize } = clampPagination(raw.page, raw.pageSize, 20);

    const result = await getLoginSessions({
      startDate,
      endDate,
      search: String(raw.search ?? ''),
      page,
      pageSize,
    });

    const response: PaginatedResponse<typeof result.data[0]> = {
      data: result.data,
      total: result.total,
      page,
      pageSize,
      totalPages: Math.ceil(result.total / pageSize) || 1,
    };
    res.json(response);
  } catch (err) { next(err); }
}

/* ───────────────────────────────────────────────────────────────
 *  8. POST /api/v1/activity/aggregate — trigger aggregation
 *
 *  Body params:
 *    { date?: "YYYY-MM-DD" }       — aggregate single date
 *    { startDate, endDate }        — aggregate date range
 *    {}                            — aggregate today (default)
 * ─────────────────────────────────────────────────────────────── */

export async function triggerAggregation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { date, startDate, endDate } = req.body as {
      date?: string;
      startDate?: string;
      endDate?: string;
    };

    let rangeStart: string;
    let rangeEnd: string;

    if (startDate && endDate) {
      // Date range mode
      rangeStart = startDate;
      rangeEnd = endDate;
    } else if (date) {
      // Single date mode
      rangeStart = date;
      rangeEnd = date;
    } else {
      // Default: today (local date, not UTC)
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      rangeStart = today;
      rangeEnd = today;
    }

    const results: AggregationResult[] = await runAggregation(rangeStart, rangeEnd);

    const totalDaily = results.reduce((sum, r) => sum + r.dailyRows, 0);
    const totalHourly = results.reduce((sum, r) => sum + r.hourlyRows, 0);
    const totalModule = results.reduce((sum, r) => sum + r.moduleRows, 0);

    res.json({
      message: 'Aggregation completed',
      startDate: rangeStart,
      endDate: rangeEnd,
      datesProcessed: results.length,
      summary: {
        dailyRows: totalDaily,
        hourlyRows: totalHourly,
        moduleRows: totalModule,
      },
      details: results,
    });
  } catch (err) { next(err); }
}

/* ─────────────────────────────────────────────────────────────────
 *  9. POST /api/v1/activity/log — client-side page view logging
 *
 *  Allows the frontend to log page views for modules whose data comes
 *  from external APIs (Indemnity, ManageCare) and would otherwise never
 *  pass through this backend's accessLogger middleware.
 *
 *  Body: { module: string, menuPath: string, menuLabel: string }
 *  Auth: requires JWT (any authenticated user)
 * ───────────────────────────────────────────────────────────────── */

export async function logPageView(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { module, menuPath, menuLabel } = req.body as {
      module?: string;
      menuPath?: string;
      menuLabel?: string;
    };

    if (!module || !menuPath) {
      res.status(400).json({
        data: null,
        message: 'module and menuPath are required',
        statusCode: 400,
      });
      return;
    }

    const user = req.user;
    const startTime = Date.now();

    // SECURITY (P2.3): module sudah di-whitelist oleh logPageViewSchema
    // (zod enum) — nilai arbitrer dari user tidak pernah menyentuh DB.
    await logAccessEvent({
      userId: user?.id ?? null,
      username: user?.username ?? null,
      fullName: null,
      role: user?.role ?? null,
      actionType: 'page_view',
      menuPath: menuPath ?? null,
      menuLabel: menuLabel ?? null,
      module: module ?? null,
      method: 'GET',
      endpoint: menuPath,
      ipAddress: req.ip ?? req.socket.remoteAddress ?? null,
      userAgent: req.get('user-agent') ?? null,
      statusCode: 200,
      durationMs: Date.now() - startTime,
      sessionId: null,
    });

    res.status(200).json({ data: null, message: 'Page view logged', statusCode: 200 });
  } catch (err) { next(err); }
}