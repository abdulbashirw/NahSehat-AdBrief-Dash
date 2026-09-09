/**
 * User controller — CRUD operations for user management.
 */
import type { Response, NextFunction } from 'express';
import { pool } from '../models/db';
import { buildAuthUser } from '../utils/jwt';
import { createError } from '../middleware/errorHandler';
import type { AuthRequest } from '../middleware/auth';
import type { CreateUserPayload, UpdateUserPayload, PaginatedResponse, AuthUser } from '../types';
import { ANALYTICS_CATEGORIES } from '../types';
import { getSettingNumber } from '../models/settingsModel';
import bcrypt from 'bcryptjs';

/** Validate password against Min Password Length setting + complexity rules. */
async function validatePasswordPolicy(password: string): Promise<void> {
  const minLength = await getSettingNumber('passwordMinLength', 8);
  if (password.length < minLength) {
    throw createError(400, `Password must be at least ${minLength} characters long`);
  }
  if (!/[A-Z]/.test(password)) {
    throw createError(400, 'Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    throw createError(400, 'Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    throw createError(400, 'Password must contain at least one number');
  }
}

/** Helper: fetch permissions by role name (joins roles → role_permissions) */
async function getPermissionsByRoleName(roleName: string) {
  const [permRows] = await pool.execute(
    `SELECT rp.id, rp.menu, rp.action
     FROM role_permissions rp
     JOIN roles r ON rp.role_id = r.id
     WHERE r.name = ?`,
    [roleName],
  );
  return permRows as any[];
}

/** GET /api/v1/users?page=&pageSize=&search=&role=&isActive=&analyticsCategory= */
export async function getUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page = 1, pageSize = 10, search, role, isActive, analyticsCategory } = req.query as any;
    const offset = (Number(page) - 1) * Number(pageSize);

    let where = '1=1';
    const params: any[] = [];

    if (search) { where += ' AND (u.username LIKE ? OR u.email LIKE ? OR u.full_name LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (role && role !== 'ALL') { where += ' AND u.role = ?'; params.push(role); }
    if (isActive !== undefined && isActive !== '') { where += ' AND u.is_active = ?'; params.push(isActive === 'true' || isActive === '1' ? 1 : 0); }
    if (analyticsCategory && analyticsCategory !== 'ALL') { where += ' AND u.analytics_category = ?'; params.push(analyticsCategory); }

    const [[countRow]] = await pool.query<any[]>(`SELECT COUNT(*) as total FROM users u WHERE ${where}`, params);
    const total = Number(countRow.total);
    const totalPages = Math.ceil(total / Number(pageSize)) || 1;

    const [rows] = await pool.query<any[]>(
      `SELECT u.* FROM users u WHERE ${where} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
      [...params, Number(pageSize), offset],
    );

    const data: AuthUser[] = [];
    for (const u of rows) {
      const permRows = await getPermissionsByRoleName(u.role);
      const [payorRows] = await pool.execute('SELECT payor_id FROM user_payors WHERE user_id = ?', [u.id]);
      data.push(buildAuthUser(u, permRows, (payorRows as any[]).map((p: any) => p.payor_id)));
    }

    const result: PaginatedResponse<AuthUser> = { data, total, page: Number(page), pageSize: Number(pageSize), totalPages };
    res.json(result);
  } catch (err) { next(err); }
}

/** GET /api/v1/users/:id */
export async function getUserById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [req.params.id]);
    const user = (rows as any[])[0];
    if (!user) throw createError(404, 'User not found');

    const permRows = await getPermissionsByRoleName(user.role);
    const [payorRows] = await pool.execute('SELECT payor_id FROM user_payors WHERE user_id = ?', [user.id]);

    res.json(buildAuthUser(user, permRows, (payorRows as any[]).map((p: any) => p.payor_id)));
  } catch (err) { next(err); }
}

/** POST /api/v1/users */
export async function createUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { username, email, password, fullName, role, analyticsCategory, payorIds, isActive } = req.body as CreateUserPayload;

    if (!username || !email || !password || !fullName || !role) {
      throw createError(400, 'username, email, password, fullName, role are required');
    }

    // ── analyticsCategory is REQUIRED (INS | GES | PS | Internal) ──
    if (!analyticsCategory || !ANALYTICS_CATEGORIES.includes(analyticsCategory)) {
      throw createError(400, 'analyticsCategory is required and must be one of: INS, GES, PS, Internal');
    }

    // ── Validate password against Min Password Length setting ──
    await validatePasswordPolicy(password);

    // Check uniqueness
    const [existing] = await pool.execute('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if ((existing as any[]).length > 0) throw createError(409, 'Username or email already exists');

    const hash = await bcrypt.hash(password, 10);
    const id = crypto.randomUUID();

    await pool.execute(
      'INSERT INTO users (id, username, email, password, full_name, role, analytics_category, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, username, email, hash, fullName, role, analyticsCategory, isActive !== false ? 1 : 0],
    );

    // Assign payors
    if (payorIds && payorIds.length > 0) {
      const values = payorIds.map(pid => [id, pid]);
      await pool.query('INSERT INTO user_payors (user_id, payor_id) VALUES ?', [values]);
    }

    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
    const user = (rows as any[])[0];

    const permRows = await getPermissionsByRoleName(user.role);
    const [payorRows] = await pool.execute('SELECT payor_id FROM user_payors WHERE user_id = ?', [id]);

    res.status(201).json(buildAuthUser(user, permRows, (payorRows as any[]).map((p: any) => p.payor_id)));
  } catch (err) { next(err); }
}

/** PUT /api/v1/users/:id */
export async function updateUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const body = req.body as UpdateUserPayload;

    const [existing] = await pool.execute('SELECT id FROM users WHERE id = ?', [id]);
    if ((existing as any[]).length === 0) throw createError(404, 'User not found');

    const updates: string[] = [];
    const values: any[] = [];

    if (body.fullName) { updates.push('full_name = ?'); values.push(body.fullName); }
    if (body.email) { updates.push('email = ?'); values.push(body.email); }
    if (body.role) { updates.push('role = ?'); values.push(body.role); }
    if (body.analyticsCategory !== undefined) {
      if (!ANALYTICS_CATEGORIES.includes(body.analyticsCategory)) {
        throw createError(400, 'analyticsCategory must be one of: INS, GES, PS, Internal');
      }
      updates.push('analytics_category = ?'); values.push(body.analyticsCategory);
    }
    if (body.isActive !== undefined) { updates.push('is_active = ?'); values.push(body.isActive ? 1 : 0); }

    if (updates.length > 0) {
      values.push(id);
      await pool.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    // Update payor assignments
    if (body.payorIds) {
      await pool.execute('DELETE FROM user_payors WHERE user_id = ?', [id]);
      if (body.payorIds.length > 0) {
        const vals = body.payorIds.map((pid: string) => [id, pid]);
        await pool.query('INSERT INTO user_payors (user_id, payor_id) VALUES ?', [vals]);
      }
    }

    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
    const user = (rows as any[])[0];

    const permRows = await getPermissionsByRoleName(user.role);
    const [payorRows] = await pool.execute('SELECT payor_id FROM user_payors WHERE user_id = ?', [id]);

    res.json(buildAuthUser(user, permRows, (payorRows as any[]).map((p: any) => p.payor_id)));
  } catch (err) { next(err); }
}

/** DELETE /api/v1/users/:id */
export async function deleteUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const [existing] = await pool.execute('SELECT id FROM users WHERE id = ?', [req.params.id]);
    if ((existing as any[]).length === 0) throw createError(404, 'User not found');

    await pool.execute('DELETE FROM user_payors WHERE user_id = ?', [req.params.id]);
    await pool.execute('DELETE FROM users WHERE id = ?', [req.params.id]);

    res.json({ message: 'User deleted' });
  } catch (err) { next(err); }
}

/** POST /api/v1/users/:id/reset-password */
export async function resetPassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    const [existing] = await pool.execute('SELECT id FROM users WHERE id = ?', [id]);
    if ((existing as any[]).length === 0) throw createError(404, 'User not found');

    // ── Validate password against Min Password Length setting ──
    if (newPassword) {
      await validatePasswordPolicy(newPassword);
    }

    const hash = await bcrypt.hash(newPassword || 'Password123!', 10);
    await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hash, id]);

    res.json({ message: 'Password reset successfully' });
  } catch (err) { next(err); }
}

/** PATCH /api/v1/users/:id/toggle-status */
export async function toggleUserStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const [existing] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
    if ((existing as any[]).length === 0) throw createError(404, 'User not found');

    await pool.execute(
      'UPDATE users SET is_active = ?, failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
      [isActive ? 1 : 0, id],
    );

    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
    const user = (rows as any[])[0];

    const permRows = await getPermissionsByRoleName(user.role);
    const [payorRows] = await pool.execute('SELECT payor_id FROM user_payors WHERE user_id = ?', [id]);

    res.json(buildAuthUser(user, permRows, (payorRows as any[]).map((p: any) => p.payor_id)));
  } catch (err) { next(err); }
}