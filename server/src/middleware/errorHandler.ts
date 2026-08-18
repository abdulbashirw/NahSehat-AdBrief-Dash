/**
 * Global error handler — converts thrown errors to consistent JSON responses.
 */
import type { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  status?: number;
  details?: any;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const status = err.status || 500;
  const message = status === 500 ? 'Internal server error' : err.message;

  if (status >= 500) {
    console.error(`[ERROR] ${status}: ${err.message}`, err.stack);
  }

  res.status(status).json({
    data: null,
    message,
    statusCode: status,
    ...(err.details ? { details: err.details } : {}),
  });
}

/** Helper to create typed errors with HTTP status */
export function createError(status: number, message: string, details?: any): AppError {
  const err: AppError = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
}