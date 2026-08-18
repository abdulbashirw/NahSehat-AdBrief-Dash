/**
 * Auth middleware — verifies JWT token and attaches user info to request.
 * Also checks the token blacklist to reject logged-out tokens.
 */
import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { isTokenBlacklisted } from '../models/tokenBlacklist';
import { createError } from '../middleware/errorHandler';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
  };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(createError(401, 'No token provided'));
  }

  try {
    const token = header.slice(7);

    // Check if token has been blacklisted (e.g., after logout)
    if (isTokenBlacklisted(token)) {
      return next(createError(401, 'Token has been revoked'));
    }

    req.user = verifyToken(token);
    next();
  } catch {
    next(createError(401, 'Invalid or expired token'));
  }
}

/** Role-based access control middleware */
export function authorize(...roles: string[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(createError(401, 'Not authenticated'));
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return next(createError(403, 'Insufficient permissions'));
    }
    next();
  };
}