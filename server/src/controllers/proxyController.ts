/**
 * NahSehat API v3 proxy (P1c).
 *
 * The frontend no longer calls the external NahSehat API v3 directly.
 * This server forwards whitelisted endpoints while:
 *   - authenticating the end user (JWT) via `authenticate` middleware
 *   - enforcing payor scoping: payor_code must be assigned to the user
 *     (user_payors) unless the user is SUPER_ADMIN
 *   - forwarding the user's JWT to upstream — upstream validates using
 *     the same JWT issued by this system
 *
 * SECURITY (pentest finding #4): upstream error bodies are NEVER forwarded
 * to the client (verbose error / schema disclosure). Details are logged
 * server-side only; the client receives a generic message.
 */
import type { Response, NextFunction } from 'express';
import { nahsehatApiV3Config } from '../config';
import { createError } from '../middleware/errorHandler';
import type { AuthRequest } from '../middleware/auth';
import { bypassesPayorScope, isPayorCodeAllowed } from '../utils/payorScope';

/** Validated proxy request body (adBriefRequestSchema). */
interface AdBriefBody {
  payor_code: string;
  start_date: string;
  end_date: string;
}

/** True when the proxy has its upstream base URL configured. */
function isProxyConfigured(): boolean {
  return Boolean(nahsehatApiV3Config.baseUrl);
}

/** Forward a validated body to a whitelisted NahSehat API v3 endpoint. */
async function forwardToNahsehat(
  endpoint: string,
  body: AdBriefBody,
  userToken: string,
): Promise<{ status: number; payload: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), nahsehatApiV3Config.timeoutMs);
  try {
    const res = await fetch(`${nahsehatApiV3Config.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward user's JWT — upstream validates with the same secret.
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await res.json().catch(() => null);
    return { status: res.status, payload };
  } finally {
    clearTimeout(timer);
  }
}

/** Shared handler for both proxied endpoints. */
async function proxyAdBrief(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
  endpoint: string,
): Promise<void> {
  try {
    const user = req.user!;
    const { payor_code, start_date, end_date } = req.body as AdBriefBody;

    // SECURITY (P1c — LIDOR): payor_code must be assigned to the user.
    // Runs BEFORE the config gate so unauthorized payor codes are always
    // rejected (403) even when the upstream is not configured (503) —
    // never leak configuration state to unscoped callers.
    if (!bypassesPayorScope(user.role)) {
      const allowed = await isPayorCodeAllowed(user.id, payor_code);
      if (!allowed) throw createError(403, 'Payor not assigned to your account');
    }

    if (!isProxyConfigured()) {
      throw createError(503, 'Upstream service not configured');
    }

    // Extract user's JWT from the Authorization header.
    const authHeader = req.headers.authorization ?? '';
    const userToken = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    if (!userToken) {
      throw createError(401, 'Missing authorization token');
    }

    let upstream: { status: number; payload: unknown };
    try {
      upstream = await forwardToNahsehat(endpoint, { payor_code, start_date, end_date }, userToken);
    } catch (err) {
      // AbortError → upstream timeout; everything else → generic 502.
      if ((err as Error).name === 'AbortError') {
        throw createError(504, 'Upstream request timed out');
      }
      console.error(`[proxy] ${endpoint} upstream unreachable:`, (err as Error).message);
      throw createError(502, 'Upstream request failed');
    }

    // SECURITY (finding #4): never forward upstream error bodies.
    if (upstream.status >= 400) {
      console.error(
        `[proxy] ${endpoint} upstream ${upstream.status}:`,
        JSON.stringify(upstream.payload)?.slice(0, 500) ?? '(non-JSON)',
      );
      throw createError(
        upstream.status === 429 ? 429 : 502,
        'Upstream request failed',
      );
    }

    // 2xx — pass the payload through unchanged (client-side transforms
    // depend on the upstream shape; no transformation here).
    res.status(upstream.status).json(upstream.payload ?? {});
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/indemnity/AdmDailyClaim */
export async function proxyAdmDailyClaim(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await proxyAdBrief(req, res, next, '/AdmDailyClaim');
}

/** POST /api/v1/managecare/dailyMonitoring */
export async function proxyDailyMonitoring(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await proxyAdBrief(req, res, next, '/dailyMonitoring');
}