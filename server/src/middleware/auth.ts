/**
 * Auth middleware — verifies JWT token and attaches user info to request.
 * Also checks the token blacklist to reject logged-out tokens.
 */
import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { isTokenBlacklisted } from '../models/tokenBlacklist';
import { createError } from '../middleware/errorHandler';
import { pool } from '../models/db';

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

/**
 * Granular permission middleware factory.
 *
 * Checks whether the authenticated user's role has a specific
 * (menu, action) entry in the role_permissions table.
 * SUPER_ADMIN bypasses all permission checks.
 *
 * Usage:
 *   router.put('/:id', authorize('SUPER_ADMIN', 'ADMIN'), checkPermission('cms-users', 'update'), updateUser);
 *
 * This queries the database on each request — acceptable for low-frequency
 * CMS admin operations. For high-traffic endpoints, consider caching or
 * embedding permissions in the JWT payload.
 */
export function checkPermission(menu: string, action: string) {
  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) return next(createError(401, 'Not authenticated'));

      // SUPER_ADMIN bypasses all granular permission checks
      if (req.user.role === 'SUPER_ADMIN') {
        return next();
      }

      // Query role_permissions for the user's role
      const [rows] = await pool.execute(
        `SELECT 1 FROM role_permissions rp
         JOIN roles r ON rp.role_id = r.id
         WHERE r.name = ? AND rp.menu = ? AND rp.action = ?
         LIMIT 1`,
        [req.user.role, menu, action],
      );

      if ((rows as any[]).length === 0) {
        return next(createError(403, `Insufficient permissions: requires ${menu}:${action}`));
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}