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
import { logLoginSession, logLogoutSession } from '../models/activityModel';
import { bumpTokenVersion } from '../models/userSecurityModel';
import { recordPasswordChange, isPasswordReused } from '../models/passwordHistoryModel';
import { BCRYPT_ROUNDS, BCRYPT_MIN_ROUNDS, bcryptCost, isPwnedPassword } from '../utils/security';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * SECURITY (P1.5 — anti user-enumeration): bcrypt hash dummy yang dihitung
 * sekali saat startup. Dipakai untuk membandingkan password user yang
 * TIDAK ada, sehingga waktu respons identik dengan user yang ada
 * (anti timing attack). Cost mengikuti BCRYPT_ROUNDS agar timing konsisten
 * dengan hash user nyata (P3: cost 12).
 */
const DUMMY_HASH = bcrypt.hashSync(
  'no-such-user-' + crypto.randomBytes(16).toString('hex'),
  BCRYPT_ROUNDS,
);

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

    // ── SECURITY (P1.5 — anti user-enumeration) ────────────────────────
    // Semua path gagal mengembalikan respons IDENTIK: 401 "Invalid credentials".
    // Detail (lockout, jumlah percobaan, unlock time) hanya ke log server.
    // Dummy bcrypt compare menjaga timing tetap konsisten.
    if (users.length === 0) {
      await bcrypt.compare(password, DUMMY_HASH); // anti timing attack
      throw createError(401, 'Invalid credentials');
    }

    const user = users[0];
    const maxAttempts = await getSettingNumber('maxLoginAttempts', 5);

    // ── Check account lockout (Max Login Attempts setting) ──
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      console.warn('[auth] Login blocked: account locked');
      throw createError(401, 'Invalid credentials');
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
        console.warn(`[auth] Account locked after ${maxAttempts} failed attempts`);
      } else {
        await pool.execute(
          'UPDATE users SET failed_login_attempts = ? WHERE id = ?',
          [newAttempts, user.id],
        );
        console.warn(`[auth] Failed login attempt (${newAttempts}/${maxAttempts})`);
      }
      throw createError(401, 'Invalid credentials');
    }

    // ── Reset failed login attempts on successful password verification ──
    if (user.failed_login_attempts > 0 || user.locked_until) {
      await pool.execute(
        'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
        [user.id],
      );
    }

    // ── SECURITY (P3 — progressive bcrypt upgrade): jika hash tersimpan
    // masih memakai cost lama (< BCRYPT_MIN_ROUNDS), rehash dengan cost
    // baru saat login. Transparan bagi user; memperkuat semua hash
    // seiring waktu tanpa memaksa reset password massal.
    if (bcryptCost(user.password) < BCRYPT_MIN_ROUNDS) {
      const upgraded = await bcrypt.hash(password, BCRYPT_ROUNDS);
      await pool.execute('UPDATE users SET password = ? WHERE id = ?', [upgraded, user.id]);
      console.info(`[auth] bcrypt cost upgraded to ${BCRYPT_ROUNDS} on login`);
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

    const token = signToken({
      id: user.id,
      username: user.username,
      role: user.role,
      ver: Number(user.token_version ?? 0),
    });
    const authUser = buildAuthUser(user, permRows as any[], (payorRows as any[]).map((p: any) => p.payor_id));

    // ── Log login session for activity tracking ──
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    logLoginSession({
      userId: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role,
      analyticsCategory: (user as any).analytics_category ?? null,
      ipAddress: req.ip ?? req.socket.remoteAddress ?? null,
      userAgent: req.get('user-agent') ?? null,
      tokenHash,
    }).catch(() => console.error('[authController] Failed to log login session'));

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

      // ── Log logout session for activity tracking ──
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      logLogoutSession(tokenHash, 'user').catch((err) =>
        console.error('[authController] Failed to log logout session'),
      );
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
    if (email) {
      // ── SECURITY (P3 / M10): cegah email duplikat — dua akun tidak boleh
      // berbagi email (login by email bisa mengambil alih identitas). ──
      const [dupRows] = await pool.execute(
        'SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1',
        [email, req.user.id],
      );
      if ((dupRows as any[]).length > 0) {
        throw createError(409, 'Email is already in use by another account');
      }
      updates.push('email = ?'); values.push(email);
    }
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

    // ── SECURITY (P3): tolak password yang muncul di korpus kebocoran
    // data (HIBP, k-anonymity — password tidak dikirim ke luar).
    // Fail-open jika API tidak reachable. ──
    const pwnedCount = await isPwnedPassword(newPassword);
    if (pwnedCount > 0) {
      throw createError(400, 'Password appears in known data breaches — please choose a different one');
    }

    // ── SECURITY (P3): tolak daur ulang 5 password terakhir. ──
    if (await isPasswordReused(req.user.id, newPassword)) {
      throw createError(400, 'New password must differ from your recent passwords');
    }

    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // ── SECURITY (P1.3): bump token_version → semua session LAIN (device
    // lain / token curian) langsung invalid. Token baru untuk session ini
    // dikembalikan agar user tidak ter-logout dari device saat ini.
    const newVersion = await bumpTokenVersion(req.user.id);
    await recordPasswordChange(req.user.id, user.password); // simpan hash LAMA
    await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hash, req.user.id]);

    const token = signToken({
      id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      ver: newVersion,
    });

    res.json({ message: 'Password changed successfully', token });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/auth/logout-all — revoke semua token user (semua device). */
export async function logoutAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw createError(401, 'Not authenticated');

    const newVersion = await bumpTokenVersion(req.user.id);

    // Issue a fresh token for the current session (other devices stay logged out)
    const token = signToken({
      id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      ver: newVersion,
    });

    console.info('[auth] logout-all: previous tokens revoked');
    res.json({ message: 'All other sessions have been logged out', token });
  } catch (err) {
    next(err);
  }
}