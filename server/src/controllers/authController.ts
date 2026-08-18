/**
 * Auth controller — login, validate, logout.
 */
import type { Request, Response, NextFunction } from 'express';
import { pool } from '../models/db';
import { signToken, signTempToken, buildAuthUser } from '../utils/jwt';
import { createError } from '../middleware/errorHandler';
import type { AuthRequest } from '../middleware/auth';
import type { LoginRequest } from '../types';
import { blacklistToken } from '../models/tokenBlacklist';
import { getSettingNumber } from '../models/settingsModel';
import bcrypt from 'bcryptjs';

/** Validate password against Min Password Length setting + complexity rules. */
async function validatePasswordPolicy(newPassword: string): Promise<void> {
  const minLength = await getSettingNumber('passwordMinLength', 8);
  if (newPassword.length < minLength) {
    throw createError(400, `Password must be at least ${minLength} characters long`);
  }
  if (!/[A-Z]/.test(newPassword)) {
    throw createError(400, 'Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(newPassword)) {
    throw createError(400, 'Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(newPassword)) {
    throw createError(400, 'Password must contain at least one number');
  }
}

/** POST /api/v1/auth/login */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, password } = req.body as LoginRequest;

    if (!name || !password) {
      throw createError(400, 'Username and password are required');
    }

    // Find user by username or email
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE (username = ? OR email = ?) AND is_active = 1',
      [name, name],
    );
    const users = rows as any[];

    if (users.length === 0) {
      throw createError(401, 'Invalid credentials');
    }

    const user = users[0];

    // ── Check account lockout (Max Login Attempts setting) ──
    const maxAttempts = await getSettingNumber('maxLoginAttempts', 5);
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const unlockTime = new Date(user.locked_until).toLocaleString('id-ID', {
        hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit',
      });
      throw createError(423, `Account is locked due to too many failed login attempts. Try again after ${unlockTime}.`);
    }

    // If lockout period has expired, reset the counter
    if (user.locked_until && new Date(user.locked_until) <= new Date()) {
      await pool.execute(
        'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
        [user.id],
      );
      user.failed_login_attempts = 0;
      user.locked_until = null;
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      // ── Increment failed attempts and lock if threshold reached ──
      const newAttempts = (user.failed_login_attempts || 0) + 1;
      if (newAttempts >= maxAttempts) {
        // Lock account for 15 minutes
        await pool.execute(
          'UPDATE users SET failed_login_attempts = ?, locked_until = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id = ?',
          [newAttempts, user.id],
        );
        throw createError(423, `Account locked after ${maxAttempts} failed login attempts. Try again in 15 minutes.`);
      } else {
        await pool.execute(
          'UPDATE users SET failed_login_attempts = ? WHERE id = ?',
          [newAttempts, user.id],
        );
        const remaining = maxAttempts - newAttempts;
        throw createError(401, `Invalid credentials. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before lockout.`);
      }
    }

    // ── Reset failed login attempts on successful password verification ──
    if (user.failed_login_attempts > 0 || user.locked_until) {
      await pool.execute(
        'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
        [user.id],
      );
    }

    // Fetch permissions via role_id (users.role = 'SUPER_ADMIN' → roles.id = 'rol-super-admin')
    const [permRows] = await pool.execute(
      `SELECT rp.id, rp.menu, rp.action
       FROM role_permissions rp
       JOIN roles r ON rp.role_id = r.id
       WHERE r.name = ?`,
      [user.role],
    );

    // Fetch payor assignments
    const [payorRows] = await pool.execute(
      'SELECT payor_id FROM user_payors WHERE user_id = ?',
      [user.id],
    );

    // If 2FA is enabled, return a temp token for the second verification step
    if (user.two_factor_enabled) {
      const tempToken = signTempToken({ id: user.id, username: user.username, role: user.role, twoFactorPending: true });
      res.json({ requiresTwoFactor: true, tempToken });
      return;
    }

    const token = signToken({ id: user.id, username: user.username, role: user.role });
    const authUser = buildAuthUser(user, permRows as any[], (payorRows as any[]).map((p: any) => p.payor_id));

    res.json({ token, user: authUser });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/auth/validate */
export async function validateToken(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw createError(401, 'Not authenticated');

    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ? AND is_active = 1', [req.user.id]);
    const users = rows as any[];
    if (users.length === 0) throw createError(401, 'User not found or inactive');

    const user = users[0];

    const [permRows] = await pool.execute(
      `SELECT rp.id, rp.menu, rp.action
       FROM role_permissions rp
       JOIN roles r ON rp.role_id = r.id
       WHERE r.name = ?`,
      [user.role],
    );
    const [payorRows] = await pool.execute(
      'SELECT payor_id FROM user_payors WHERE user_id = ?',
      [user.id],
    );

    const authUser = buildAuthUser(user, permRows as any[], (payorRows as any[]).map((p: any) => p.payor_id));

    res.json({ valid: true, user: authUser });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/auth/logout */
export async function logout(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      const token = header.slice(7);
      // Add token to blacklist so it cannot be reused
      blacklistToken(token);
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/v1/auth/profile */
export async function updateProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw createError(401, 'Not authenticated');

    const { fullName, email, phone } = req.body;
    const updates: string[] = [];
    const values: any[] = [];

    if (fullName) { updates.push('full_name = ?'); values.push(fullName); }
    if (email) { updates.push('email = ?'); values.push(email); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }

    if (updates.length === 0) throw createError(400, 'No fields to update');

    values.push(req.user.id);
    await pool.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const user = (rows as any[])[0];

    const [permRows] = await pool.execute(
      `SELECT rp.id, rp.menu, rp.action
       FROM role_permissions rp
       JOIN roles r ON rp.role_id = r.id
       WHERE r.name = ?`,
      [user.role],
    );
    const [payorRows] = await pool.execute('SELECT payor_id FROM user_payors WHERE user_id = ?', [user.id]);

    res.json({ user: buildAuthUser(user, permRows as any[], (payorRows as any[]).map((p: any) => p.payor_id)) });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/auth/change-password */
export async function changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw createError(401, 'Not authenticated');

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) throw createError(400, 'Current and new password required');

    const [rows] = await pool.execute('SELECT password FROM users WHERE id = ?', [req.user.id]);
    const user = (rows as any[])[0];

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw createError(401, 'Current password is incorrect');

    // ── Validate new password against Min Password Length setting ──
    await validatePasswordPolicy(newPassword);

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hash, req.user.id]);

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
}