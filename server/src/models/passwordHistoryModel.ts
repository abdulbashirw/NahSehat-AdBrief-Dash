/**
 * Password history model (P3 — L4).
 *
 * Simpan hash password LAMA setiap kali password diganti/reset, dan cek
 * password baru terhadap N hash terakhir (default 5) agar user tidak
 * mendaur ulang password lama (NIST 800-63B / OWASP ASVS 2.1.7).
 *
 * Tabel: user_password_history (migration 005_password_history.sql).
 * Cleanup: baris > MAX_HISTORY per user dihapus saat insert (rolling window).
 */
import { pool } from './db';

/** Berapa hash password terakhir yang dicek. */
export const PASSWORD_HISTORY_DEPTH = 5;

/**
 * Record the PREVIOUS password hash into history (call BEFORE updating
 * users.password). Keeps only the most recent PASSWORD_HISTORY_DEPTH rows.
 */
export async function recordPasswordChange(userId: string, oldHash: string): Promise<void> {
  await pool.execute(
    'INSERT INTO user_password_history (user_id, password_hash) VALUES (?, ?)',
    [userId, oldHash],
  );
  await pool.execute(
    `DELETE FROM user_password_history
      WHERE user_id = ?
        AND id NOT IN (
          SELECT id FROM (
            SELECT id FROM user_password_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
          ) AS keep
        )`,
    [userId, userId, PASSWORD_HISTORY_DEPTH],
  );
}

/**
 * Check whether newPassword matches any of the user's recent passwords.
 * Returns true if reused (→ caller rejects with 400).
 */
export async function isPasswordReused(userId: string, newPassword: string): Promise<boolean> {
  const [rows] = await pool.execute(
    `SELECT password_hash FROM user_password_history
      WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    [userId, PASSWORD_HISTORY_DEPTH],
  );
  const hashes = (rows as any[]).map((r) => r.password_hash as string);
  for (const hash of hashes) {
    // bcrypt.compare never throws on malformed hash — returns false
    if (await bcryptCompare(newPassword, hash)) return true;
  }
  return false;
}

// Local import to avoid circular deps; bcryptjs is cheap to import twice.
import bcrypt from 'bcryptjs';
async function bcryptCompare(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}