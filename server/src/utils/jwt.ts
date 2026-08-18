/**
 * JWT utility — sign and verify tokens.
 */
import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config';
import type { AuthUser } from '../types';

export interface JwtPayload {
  id: string;
  username: string;
  role: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, jwtConfig.secret, { expiresIn: jwtConfig.expiresIn } as jwt.SignOptions);
}

/** Sign a short-lived temp token for 2FA login verification (5 minutes). */
export function signTempToken(payload: { id: string; username: string; role: string; twoFactorPending: true }): string {
  return jwt.sign(payload, jwtConfig.secret, { expiresIn: '5m' } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, jwtConfig.secret) as JwtPayload;
}

/** Build a safe AuthUser object for the response (no password). */
export function buildAuthUser(row: any, permissions: any[] = [], payorIds: string[] = []): AuthUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone || '',
    role: row.role,
    permissions: permissions.map((p: any) => ({
      id: String(p.id),
      menu: p.menu,
      action: p.action,
    })),
    payorIds,
    isActive: Boolean(row.is_active),
    twoFactorEnabled: Boolean(row.two_factor_enabled),
  };
}