/**
 * In-memory token blacklist — stores invalidated JWTs until they expire.
 *
 * On logout, the token's jti (or the raw token) is added to the blacklist
 * with a TTL equal to the token's remaining lifetime. A periodic sweep
 * removes expired entries to prevent memory leaks.
 *
 * For multi-server deployments, replace this with a Redis-backed store.
 */
import jwt from 'jsonwebtoken';

interface BlacklistEntry {
  /** The token string (used as key) */
  token: string;
  /** Expiry timestamp (ms since epoch) — when this entry can be removed */
  expiresAt: number;
}

/** Map from token string → BlacklistEntry */
const blacklist = new Map<string, BlacklistEntry>();

/** Sweep interval — clean up expired entries every 60 seconds */
const SWEEP_INTERVAL_MS = 60_000;

let sweepTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Add a token to the blacklist.
 * Extracts the expiry from the JWT payload to auto-calculate TTL.
 */
export function blacklistToken(token: string): void {
  try {
    const decoded = jwt.decode(token) as { exp?: number } | null;
    if (!decoded?.exp) {
      // Cannot determine expiry — blacklist for 24h as safety net
      const entry: BlacklistEntry = {
        token,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      };
      blacklist.set(token, entry);
      return;
    }

    const expiresAt = decoded.exp * 1000; // exp is in seconds
    // Only blacklist if the token hasn't already expired
    if (expiresAt > Date.now()) {
      blacklist.set(token, { token, expiresAt });
    }
  } catch {
    // Token is malformed — blacklist for 24h as safety net
    blacklist.set(token, {
      token,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });
  }
}

/**
 * Check if a token has been blacklisted.
 */
export function isTokenBlacklisted(token: string): boolean {
  const entry = blacklist.get(token);
  if (!entry) return false;
  // If the entry has expired, remove it and return false
  if (entry.expiresAt <= Date.now()) {
    blacklist.delete(token);
    return false;
  }
  return true;
}

/**
 * Remove expired entries from the blacklist to prevent memory leaks.
 */
function sweepExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of blacklist.entries()) {
    if (entry.expiresAt <= now) {
      blacklist.delete(key);
    }
  }
}

/**
 * Start the periodic sweep timer.
 * Call this once at server startup.
 */
export function startBlacklistSweep(): void {
  if (sweepTimer) return; // Already running
  sweepTimer = setInterval(sweepExpiredEntries, SWEEP_INTERVAL_MS);
  // Don't prevent Node from shutting down
  if (sweepTimer && typeof sweepTimer === 'object' && 'unref' in sweepTimer) {
    sweepTimer.unref();
  }
}

/**
 * Stop the periodic sweep timer (for tests / graceful shutdown).
 */
export function stopBlacklistSweep(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
}

/**
 * Get the current blacklist size (for monitoring / debugging).
 */
export function getBlacklistSize(): number {
  return blacklist.size;
}