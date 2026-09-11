/**
 * User security model — token version helpers for instant JWT revocation.
 *
 * token_version disimpan di tabel users. Setiap JWT membawa klaim `ver`;
 * middleware authenticate() membandingkan klaim dengan nilai DB (cache 30s).
 * Jika tidak cocok → 401. Bump version = semua token lama user invalid.
 *
 * Cache TTL 30s: perubahan efektif di semua instance dalam ≤30 detik
 * (trade-off yang disengaja agar tidak ada query DB per-request).
 */
import { pool } from './db';

const CACHE_TTL_MS = 30_000;

interface VersionCacheEntry {
  ver: number;
  expiresAt: number;
}

const cache = new Map<string, VersionCacheEntry>();

/** Invalidate the cached version for a user (call after any bump). */
export function invalidateTokenVersionCache(userId: string): void {
  cache.delete(userId);
}

/**
 * Get the current token_version for a user (cached 30s).
 * Returns null if the user no longer exists.
 */
export async function getTokenVersion(userId: string): Promise<number | null> {
  const hit = cache.get(userId);
  if (hit && hit.expiresAt > Date.now()) return hit.ver;

  const [rows] = await pool.execute(
    'SELECT token_version FROM users WHERE id = ?',
    [userId],
  );
  const row = (rows as any[])[0];
  if (!row) return null;

  const ver = Number(row.token_version ?? 0);
  cache.set(userId, { ver, expiresAt: Date.now() + CACHE_TTL_MS });
  return ver;
}

/**
 * Bump token_version — instantly revokes every previously issued token
 * for this user across all server instances.
 * Returns the new version.
 */
export async function bumpTokenVersion(userId: string): Promise<number> {
  await pool.execute(
    'UPDATE users SET token_version = token_version + 1 WHERE id = ?',
    [userId],
  );
  invalidateTokenVersionCache(userId);

  const [rows] = await pool.execute(
    'SELECT token_version FROM users WHERE id = ?',
    [userId],
  );
  return Number((rows as any[])[0]?.token_version ?? 0);
}