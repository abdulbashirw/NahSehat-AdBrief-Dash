/**
 * Global error handler — converts thrown errors to consistent JSON responses.
 *
 * SECURITY (pentest findings #2 & #4):
 *   - Only errors created via `createError()` (which explicitly set `status`)
 *     have their message forwarded to the client. Library/MySQL errors that
 *     lack an explicit `status` are ALWAYS masked as "Internal server error",
 *     regardless of the HTTP status code — this prevents hostname, SQL query,
 *     table name, and schema disclosure.
 *   - MySQL-specific error properties (`sql`, `sqlMessage`, `sqlState`,
 *     `errno`, `code`) are NEVER included in the response.
 *   - `details` is only forwarded for 400 validation errors with explicit
 *     `status` (i.e., created via `createError(400, …, details)`).
 *   - Production logs are sanitized — no full error messages or stack traces
 *     that could contain internal hostnames, DB credentials, or SQL.
 */
import type { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  status?: number;
  details?: any;
}

/**
 * True when the error was explicitly created via `createError()` — its
 * message is safe to forward. Library/MySQL errors never set `status`.
 */
function isSafeError(err: AppError): boolean {
  return typeof err.status === 'number';
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // If the error was NOT created via createError(), treat it as 500 and
  // mask the message — it may contain MySQL/library internals.
  const safe = isSafeError(err);
  const status = safe ? err.status! : 500;
  const message = safe && status < 500 ? err.message : 'Internal server error';

  // ── Logging ────────────────────────────────────────────────────────
  // In production: generic log only (no hostnames, SQL, or stack traces).
  // In development: full error for debugging convenience.
  if (status >= 500) {
    if (process.env.NODE_ENV === 'production') {
      console.error(`[ERROR] ${status}: internal server error`);
    } else {
      console.error(`[ERROR] ${status}: ${err.message}`, err);
    }
  }

  // ── Response ───────────────────────────────────────────────────────
  // `details` only for 400 validation errors from createError() — never
  // for library errors or non-400 statuses (defense in depth).
  res.status(status).json({
    data: null,
    message,
    statusCode: status,
    ...(safe && status === 400 && err.details ? { details: err.details } : {}),
  });
}

/** Helper to create typed errors with HTTP status */
export function createError(status: number, message: string, details?: any): AppError {
  const err: AppError = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
}