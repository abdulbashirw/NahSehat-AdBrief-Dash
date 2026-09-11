/**
 * Two-Factor Authentication controller — TOTP (RFC 6238).
 *
 * Compatible with Google Authenticator, Authy, Microsoft Authenticator, etc.
 *
 * Flow:
 *  1. setup2FA   — generate secret, return QR code URI + manual entry key
 *  2. verify2FA  — verify TOTP code, persist secret, enable 2FA
 *  3. disable2FA — verify current password, clear secret, disable 2FA
 *  4. verify2FALogin — verify TOTP during login (using temp token)
 */
import type { Request, Response, NextFunction } from 'express';
import { TOTP, generateSecret, NobleCryptoPlugin, ScureBase32Plugin } from 'otplib';
import QRCode from 'qrcode';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool } from '../models/db';
import { verifyToken, signToken, buildAuthUser } from '../utils/jwt';
import { createError } from '../middleware/errorHandler';
import type { AuthRequest } from '../middleware/auth';
import { twoFactorConfig } from '../config';
import { blacklistToken, isTokenBlacklisted } from '../models/tokenBlacklist';

/**
 * SECURITY (P1.5): anti TOTP brute-force.
 * Temp token 2FA valid 5 menit — tanpa batas percobaan, attacker bisa
 * menebak kode 6-digit. Maksimal 5 percobaan per temp token; setelah itu
 * temp token di-blacklist (semua percobaan berikutnya ditolak).
 */
const MAX_2FA_ATTEMPTS = 5;
const twoFaAttempts = new Map<string, { count: number; expiresAt: number }>();

function recordTwoFaFailure(tempToken: string): void {
  const key = crypto.createHash('sha256').update(tempToken).digest('hex');
  const now = Date.now();
  const entry = twoFaAttempts.get(key);

  // Temp token hanya berlaku 5 menit — counter ikut kedaluwarsa bersamanya
  const expiresAt = now + 5 * 60 * 1000;
  const current = entry && entry.expiresAt > now ? entry : { count: 0, expiresAt };
  current.count += 1;
  twoFaAttempts.set(key, current);

  if (current.count >= MAX_2FA_ATTEMPTS) {
    blacklistToken(tempToken); // temp token invalid untuk semua percobaan berikutnya
    twoFaAttempts.delete(key);
  }
}

function clearTwoFaAttempts(tempToken: string): void {
  const key = crypto.createHash('sha256').update(tempToken).digest('hex');
  twoFaAttempts.delete(key);
}

/** TOTP instance configured with crypto + base32 plugins (otplib v13 API). */
const totp = new TOTP({ crypto: new NobleCryptoPlugin(), base32: new ScureBase32Plugin() });

/** Encryption key for storing 2FA secrets at rest (AES-256-GCM, 32-byte key). */
const ENCRYPTION_KEY_RAW = twoFactorConfig.encryptionKey;
const KEY_BUFFER = crypto.createHash('sha256').update(ENCRYPTION_KEY_RAW).digest();

/** Encrypt a plaintext secret for storage. */
function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY_BUFFER, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

/** Decrypt a stored secret. */
function decryptSecret(ciphertext: string): string {
  const [ivHex, tagHex, dataHex] = ciphertext.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY_BUFFER, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  let decrypted = decipher.update(dataHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

const ISSUER = 'NahSehat Dashboard';

/** POST /api/v1/auth/2fa/setup */
export async function setup2FA(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw createError(401, 'Not authenticated');

    // Don't allow setup if already enabled
    const [rows] = await pool.execute('SELECT two_factor_enabled FROM users WHERE id = ?', [req.user.id]);
    const user = (rows as any[])[0];
    if (!user) throw createError(404, 'User not found');
    if (user.two_factor_enabled) throw createError(400, 'Two-factor authentication is already enabled');

    // Generate a new secret
    const secret = generateSecret({ crypto: new NobleCryptoPlugin(), base32: new ScureBase32Plugin() });

    // Store the secret temporarily (not yet enabled) so verify step can retrieve it
    await pool.execute(
      'UPDATE users SET two_factor_secret = ? WHERE id = ?',
      [encryptSecret(secret), req.user.id],
    );

    // Build otpauth URI for QR code
    const otpauthUrl = totp.toURI({ secret, label: req.user.username, issuer: ISSUER });
    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

    res.json({ secret, qrCodeUrl, manualEntry: secret });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/auth/2fa/verify — enable 2FA by verifying a TOTP code */
export async function verify2FA(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw createError(401, 'Not authenticated');

    const { token } = req.body as { token: string };
    if (!token) throw createError(400, 'Verification code is required');

    const [rows] = await pool.execute('SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = ?', [req.user.id]);
    const user = (rows as any[])[0];
    if (!user) throw createError(404, 'User not found');
    if (user.two_factor_enabled) throw createError(400, 'Two-factor authentication is already enabled');
    if (!user.two_factor_secret) throw createError(400, 'No pending 2FA setup found. Please start setup again.');

    let secret: string;
    try {
      secret = decryptSecret(user.two_factor_secret);
    } catch {
      throw createError(401, 'Invalid verification code');
    }
    // SECURITY (P1.5): totp.verify melempar exception (bukan {valid:false})
    // untuk input malformed (bukan 6 digit / bukan angka) — tanpa try/catch
    // ini jadi 500 yang bisa dipicu user input.
    let result: { valid?: boolean };
    try {
      result = await totp.verify(token, { secret });
    } catch {
      throw createError(401, 'Invalid verification code');
    }
    if (!result.valid) throw createError(401, 'Invalid verification code');

    // Enable 2FA
    await pool.execute('UPDATE users SET two_factor_enabled = 1 WHERE id = ?', [req.user.id]);

    res.json({ enabled: true });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/auth/2fa/disable — disable 2FA with current password */
export async function disable2FA(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw createError(401, 'Not authenticated');

    const { currentPassword } = req.body as { currentPassword: string };
    if (!currentPassword) throw createError(400, 'Current password is required');

    const [rows] = await pool.execute('SELECT password, two_factor_enabled FROM users WHERE id = ?', [req.user.id]);
    const user = (rows as any[])[0];
    if (!user) throw createError(404, 'User not found');

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw createError(401, 'Current password is incorrect');

    // Clear secret and disable
    await pool.execute(
      'UPDATE users SET two_factor_enabled = 0, two_factor_secret = NULL WHERE id = ?',
      [req.user.id],
    );

    res.json({ enabled: false });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/auth/verify-2fa-login — verify TOTP during login using temp token */
export async function verify2FALogin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { tempToken, token } = req.body as { tempToken: string; token: string };
    if (!tempToken || !token) throw createError(400, 'Temp token and verification code are required');

    // SECURITY (P1.5): temp token yang sudah diblacklist (5x gagal TOTP)
    // harus ditolak di sini — tanpa ini, limit percobaan tidak efektif.
    if (isTokenBlacklisted(tempToken)) {
      throw createError(401, 'Invalid or expired temp token');
    }

    // Verify temp token (catch JWT errors → 401, not 500)
    let decoded: any;
    try {
      decoded = verifyToken(tempToken);
    } catch {
      throw createError(401, 'Invalid or expired temp token');
    }
    if (!decoded.twoFactorPending) throw createError(401, 'Invalid temp token');

    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ? AND is_active = 1', [decoded.id]);
    const user = (rows as any[])[0];
    if (!user) throw createError(401, 'User not found or inactive');
    if (!user.two_factor_enabled || !user.two_factor_secret) {
      throw createError(400, 'Two-factor authentication is not enabled for this account');
    }

    let secret: string;
    try {
      secret = decryptSecret(user.two_factor_secret);
    } catch {
      // Secret korup / format lama — jangan biarkan jadi 500 (info leak)
      throw createError(401, 'Invalid or expired temp token');
    }
    // SECURITY (P1.5): totp.verify melempar exception (bukan {valid:false})
    // untuk input malformed (bukan 6 digit / bukan angka) — tanpa try/catch
    // ini jadi 500 yang bisa dipicu user input.
    let result: { valid?: boolean };
    try {
      result = await totp.verify(token, { secret });
    } catch {
      recordTwoFaFailure(tempToken);
      throw createError(401, 'Invalid verification code');
    }
    if (!result.valid) {
      // SECURITY (P1.5): hitung percobaan gagal — 5x gagal → temp token diblacklist
      recordTwoFaFailure(tempToken);
      throw createError(401, 'Invalid verification code');
    }
    clearTwoFaAttempts(tempToken);

    // Issue the real token (with token_version claim for instant revocation)
    const authToken = signToken({
      id: user.id,
      username: user.username,
      role: user.role,
      ver: Number(user.token_version ?? 0),
    });

    const [permRows] = await pool.execute(
      `SELECT rp.id, rp.menu, rp.action
       FROM role_permissions rp
       JOIN roles r ON rp.role_id = r.id
       WHERE r.name = ?`,
      [user.role],
    );
    const [payorRows] = await pool.execute('SELECT payor_id FROM user_payors WHERE user_id = ?', [user.id]);

    const authUser = buildAuthUser(user, permRows as any[], (payorRows as any[]).map((p: any) => p.payor_id));

    res.json({ token: authToken, user: authUser });
  } catch (err) {
    next(err);
  }
}