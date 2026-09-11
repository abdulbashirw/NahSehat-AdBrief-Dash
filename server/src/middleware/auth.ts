/**
 * Auth middleware — verifies JWT token and attaches user info to request.
 * Also checks the token blacklist to reject logged-out tokens.
 */
import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { isTokenBlacklisted } from '../models/tokenBlacklist';
import { createError } from '../middleware/errorHandler';
import { pool } from '../models/db';
import { getTokenVersion } from '../models/userSecurityModel';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
    /** Token version claim (P1.3) — checked against users.token_version. */
    ver?: number;
  };
}

export async function authenticate(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
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

    // ── Token version check (P1.3) — instant revocation across instances ──
    // Compares the `ver` claim against users.token_version (cached 30s).
    // Bumped on: password change/reset, deactivation, role change, logout-all.
    try {
      const dbVersion = await getTokenVersion(req.user.id);
      if (dbVersion === null || (req.user.ver ?? 0) !== dbVersion) {
        return next(createError(401, 'Token has been revoked'));
      }
    } catch (dbErr) {
      next(dbErr);
      return;
    }

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
 * Permission cache (P3 / L6) — role_permissions jarang berubah, jadi hasil
 * query di-cache per (role, menu, action) selama 30 detik. Ini menghilangkan
 * 1 query DB per request untuk endpoint CMS. Perubahan permission (via
 * PUT /permissions/roles/:roleId) memanggil invalidatePermissionCache()
 * agar efektif seketika — TTL 30s hanya fallback multi-instance.
 */
interface PermissionCacheEntry {
  allowed: boolean;
  expiresAt: number;
}

const permissionCache = new Map<string, PermissionCacheEntry>();
const PERMISSION_CACHE_TTL_MS = 30_000;

/** Invalidate permission cache — call after any role_permissions change. */
export function invalidatePermissionCache(roleName?: string): void {
  if (!roleName) {
    permissionCache.clear();
    return;
  }
  for (const key of permissionCache.keys()) {
    if (key.startsWith(`${roleName}:`)) permissionCache.delete(key);
  }
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
 * Results are cached per (role, menu, action) for 30s (P3 / L6).
 */
export function checkPermission(menu: string, action: string) {
  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) return next(createError(401, 'Not authenticated'));

      // SUPER_ADMIN bypasses all granular permission checks
      if (req.user.role === 'SUPER_ADMIN') {
        return next();
      }

      const cacheKey = `${req.user.role}:${menu}:${action}`;
      const cached = permissionCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        if (!cached.allowed) {
          return next(createError(403, `Insufficient permissions: requires ${menu}:${action}`));
        }
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

      const allowed = (rows as any[]).length > 0;
      permissionCache.set(cacheKey, { allowed, expiresAt: Date.now() + PERMISSION_CACHE_TTL_MS });

      if (!allowed) {
        return next(createError(403, `Insufficient permissions: requires ${menu}:${action}`));
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}