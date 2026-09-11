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
import { bumpTokenVersion, invalidateTokenVersionCache } from '../models/userSecurityModel';
import { recordPasswordChange, isPasswordReused } from '../models/passwordHistoryModel';
import { BCRYPT_ROUNDS, escapeLike, isPwnedPassword } from '../utils/security';
import { logAccessEvent } from '../models/activityModel';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

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

/**
 * SECURITY (P3 / M9 — last-admin guard): pastikan target bukan satu-satunya
 * SUPER_ADMIN aktif. Mencegah lockout total CMS oleh satu aksi admin.
 */
async function assertNotLastActiveSuperAdmin(targetUserId: string): Promise<void> {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS n FROM users
      WHERE role = 'SUPER_ADMIN' AND is_active = 1 AND id != ?`,
    [targetUserId],
  );
  const others = Number((rows as any[])[0].n);
  if (others === 0) {
    throw createError(400, 'Operation blocked: this is the last active SUPER_ADMIN account');
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
    const raw = req.query as any;
    // SECURITY (P2.7): clamp pagination — page ≥ 1, pageSize ≤ 100
    const page = Math.max(Math.floor(Number(raw.page) || 1), 1);
    const pageSize = Math.min(Math.max(Math.floor(Number(raw.pageSize) || 10), 1), 100);
    const { search, role, isActive, analyticsCategory } = raw;
    const offset = (page - 1) * pageSize;

    let where = '1=1';
    const params: any[] = [];

    // SECURITY (P3 / L3): escape LIKE wildcard agar `%`/`_` dari input user
    // tidak memaksa full-table scan (LIKE-pattern DoS).
    if (search) { where += ' AND (u.username LIKE ? OR u.email LIKE ? OR u.full_name LIKE ?)'; params.push(`%${escapeLike(search)}%`, `%${escapeLike(search)}%`, `%${escapeLike(search)}%`); }
    if (role && role !== 'ALL') { where += ' AND u.role = ?'; params.push(role); }
    if (isActive !== undefined && isActive !== '') { where += ' AND u.is_active = ?'; params.push(isActive === 'true' || isActive === '1' ? 1 : 0); }
    if (analyticsCategory && analyticsCategory !== 'ALL') { where += ' AND u.analytics_category = ?'; params.push(analyticsCategory); }

    const [[countRow]] = await pool.query<any[]>(`SELECT COUNT(*) as total FROM users u WHERE ${where}`, params);
    const total = Number(countRow.total);
    const totalPages = Math.ceil(total / pageSize) || 1;

    const [rows] = await pool.query<any[]>(
      `SELECT u.* FROM users u WHERE ${where} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    );

    const data: AuthUser[] = [];
    for (const u of rows) {
      const permRows = await getPermissionsByRoleName(u.role);
      const [payorRows] = await pool.execute('SELECT payor_id FROM user_payors WHERE user_id = ?', [u.id]);
      data.push(buildAuthUser(u, permRows, (payorRows as any[]).map((p: any) => p.payor_id)));
    }

    const result: PaginatedResponse<AuthUser> = { data, total, page, pageSize, totalPages };
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

    // ── SECURITY (P3): tolak password yang muncul di korpus kebocoran
    // data (HIBP, k-anonymity). Fail-open jika API tidak reachable. ──
    const pwnedCount = await isPwnedPassword(password);
    if (pwnedCount > 0) {
      throw createError(400, 'Password appears in known data breaches — please choose a different one');
    }

    // Check uniqueness
    const [existing] = await pool.execute('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if ((existing as any[]).length > 0) throw createError(409, 'Username or email already exists');

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
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

    if (!req.user) throw createError(401, 'Not authenticated');

    const [existingRows] = await pool.execute('SELECT id, role FROM users WHERE id = ?', [id]);
    const existingUser = (existingRows as any[])[0];
    if (!existingUser) throw createError(404, 'User not found');

    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';

    // ── SECURITY (P1.2 — anti privilege escalation) ────────────────────
    // ADMIN tidak boleh memodifikasi akun SUPER_ADMIN (defense in depth),
    // dan HANYA SUPER_ADMIN yang boleh mengubah field `role`.
    if (!isSuperAdmin && existingUser.role === 'SUPER_ADMIN') {
      throw createError(403, 'Only SUPER_ADMIN can modify a SUPER_ADMIN account');
    }

    // ── SECURITY (P3 / M9 — self-protection & last-admin guard) ────────
    // (a) Tidak boleh menonaktifkan diri sendiri via updateUser.
    if (id === req.user.id && body.isActive === false) {
      throw createError(400, 'You cannot deactivate your own account — ask another SUPER_ADMIN');
    }
    // (b) Jaga minimal satu SUPER_ADMIN aktif: tolak deaktivasi/demosi
    // SUPER_ADMIN aktif jika dia satu-satunya.
    if (existingUser.role === 'SUPER_ADMIN' && (body.isActive === false || (body.role !== undefined && body.role !== 'SUPER_ADMIN'))) {
      await assertNotLastActiveSuperAdmin(id);
    }

    if (body.role !== undefined) {
      if (!isSuperAdmin) {
        throw createError(403, 'Only SUPER_ADMIN can change user roles');
      }
      // Validasi role terhadap tabel roles (tolak role arbitrer)
      const [roleRows] = await pool.execute('SELECT id FROM roles WHERE name = ?', [body.role]);
      if ((roleRows as any[]).length === 0) {
        throw createError(400, 'Invalid role');
      }
    }

    // ── SECURITY (P3 / M9 — self-protection & last-admin guard) ────────
    // Tidak ada yang boleh menonaktifkan dirinya sendiri via updateUser,
    // dan SUPER_ADMIN terakhir tidak boleh di-deactivate / di-demote.
    if (id === req.user.id && body.isActive === false) {
      throw createError(400, 'You cannot deactivate your own account — ask another SUPER_ADMIN');
    }
    if (existingUser.role === 'SUPER_ADMIN' &&
        (body.isActive === false || (body.role !== undefined && body.role !== 'SUPER_ADMIN'))) {
      await assertNotLastActiveSuperAdmin(id);
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (body.fullName) { updates.push('full_name = ?'); values.push(body.fullName); }
    if (body.email) { updates.push('email = ?'); values.push(body.email); }
    if (body.role !== undefined) { updates.push('role = ?'); values.push(body.role); }
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

    // ── SECURITY (P1.2/P1.3): perubahan role → bump token_version agar
    // token lama (dengan klaim role lama) langsung invalid + audit log.
    if (body.role !== undefined && body.role !== existingUser.role) {
      await bumpTokenVersion(id);
      logAccessEvent({
        userId: req.user.id,
        username: req.user.username,
        fullName: null,
        role: req.user.role,
        actionType: 'role_change',
        menuPath: `/api/v1/users/${id}`,
        menuLabel: 'User Management',
        module: 'cms',
        method: 'PUT',
        endpoint: `/api/v1/users/${id}`,
        ipAddress: req.ip ?? req.socket.remoteAddress ?? null,
        userAgent: req.get('user-agent') ?? null,
        statusCode: 200,
        durationMs: 0,
        sessionId: null,
      }).catch(() => console.error('[userController] Failed to log role change'));
      console.warn('[userController] Role changed');
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
    if (!req.user) throw createError(401, 'Not authenticated');

    const [existing] = await pool.execute('SELECT id, role, is_active FROM users WHERE id = ?', [req.params.id]);
    const target = (existing as any[])[0];
    if (!target) throw createError(404, 'User not found');

    // ── SECURITY (P3 / M9 — self-protection & last-admin guard) ────────
    if (req.params.id === req.user.id) {
      throw createError(400, 'You cannot delete your own account');
    }
    if (target.role === 'SUPER_ADMIN') {
      await assertNotLastActiveSuperAdmin(req.params.id);
    }

    await pool.execute('DELETE FROM user_payors WHERE user_id = ?', [req.params.id]);
    await pool.execute('DELETE FROM users WHERE id = ?', [req.params.id]);

    res.json({ message: 'User deleted' });
  } catch (err) { next(err); }
}

/** POST /api/v1/users/:id/reset-password */
export async function resetPassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { newPassword } = req.body ?? {};

    const [existing] = await pool.execute('SELECT id FROM users WHERE id = ?', [id]);
    if ((existing as any[]).length === 0) throw createError(404, 'User not found');

    // ── SECURITY (P1.4): password baru WAJIB — tidak ada lagi default
    // statis ('Password123!') yang dapat diprediksi. ──
    if (!newPassword || typeof newPassword !== 'string') {
      throw createError(400, 'newPassword is required');
    }

    // ── Validate password against Min Password Length setting ──
    await validatePasswordPolicy(newPassword);

    // ── SECURITY (P3): HIBP breach check (fail-open) + password history ──
    const pwnedCount = await isPwnedPassword(newPassword);
    if (pwnedCount > 0) {
      throw createError(400, 'Password appears in known data breaches — please choose a different one');
    }
    const [histRow] = await pool.execute('SELECT password FROM users WHERE id = ?', [id]);
    const oldHash = (histRow as any[])[0].password as string;
    if (await isPasswordReused(id, newPassword)) {
      throw createError(400, 'New password must differ from the last 5 passwords used');
    }

    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // ── SECURITY (P1.3): bump token_version → semua session user target
    // (termasuk yang mungkin dibajak) langsung invalid. ──
    await pool.execute('UPDATE users SET password = ?, token_version = token_version + 1 WHERE id = ?', [hash, id]);
    invalidateTokenVersionCache(id);
    await recordPasswordChange(id, oldHash);

    res.json({ message: 'Password reset successfully' });
  } catch (err) { next(err); }
}

/** PATCH /api/v1/users/:id/toggle-status */
export async function toggleUserStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw createError(401, 'Not authenticated');

    const { id } = req.params;
    const { isActive } = req.body;

    const [existing] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
    const target = (existing as any[])[0];
    if (!target) throw createError(404, 'User not found');

    // ── SECURITY (P3 / M9 — self-protection & last-admin guard) ────────
    if (id === req.user.id && !isActive) {
      throw createError(400, 'You cannot deactivate your own account — ask another SUPER_ADMIN');
    }
    if (!isActive && target.role === 'SUPER_ADMIN') {
      await assertNotLastActiveSuperAdmin(id);
    }

    await pool.execute(
      'UPDATE users SET is_active = ?, failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
      [isActive ? 1 : 0, id],
    );

    // ── SECURITY (P1.3/P1.4): deaktivasi → bump token_version agar token
    // user yang dinonaktifkan langsung invalid (tidak menunggu expire 24h). ──
    if (!isActive) {
      await bumpTokenVersion(id);
      console.warn('[userController] User deactivated');
    }

    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
    const user = (rows as any[])[0];

    const permRows = await getPermissionsByRoleName(user.role);
    const [payorRows] = await pool.execute('SELECT payor_id FROM user_payors WHERE user_id = ?', [id]);

    res.json(buildAuthUser(user, permRows, (payorRows as any[]).map((p: any) => p.payor_id)));
  } catch (err) { next(err); }
}