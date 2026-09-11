/**
 * Shared security utilities (P3).
 *
 *  - BCRYPT_ROUNDS   : target cost factor untuk semua hash baru (12).
 *                      Hash lama (cost 10) tetap valid dan di-upgrade
 *                      progresif saat login (rehash-on-login).
 *  - escapeLike()    : netralkan wildcard LIKE (% _) dan escape char (\)
 *                      agar input user tidak bisa memaksa full-table scan
 *                      (LIKE-pattern DoS).
 *  - isPwnedPassword(): cek password terhadap HIBP Pwned Passwords
 *                      (k-anonymity: hanya 5 karakter pertama SHA-1 yang
 *                      dikirim). FAIL-OPEN: jika API tidak reachable /
 *                      timeout → return 0 (jangan blokir login karena
 *                      dependensi eksternal).
 */
import crypto from 'crypto';

/** Cost factor untuk hash bcrypt baru (OWASP: min 10, rekomendasi 12+). */
export const BCRYPT_ROUNDS = 12;

/** Minimum bcrypt cost yang masih diterima tanpa rehash saat login. */
export const BCRYPT_MIN_ROUNDS = 12;

/**
 * Escape LIKE wildcard characters in user-supplied search terms.
 * Use for EVERY value interpolated into a LIKE pattern: `%${escapeLike(s)}%`.
 */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** Extract the cost factor from a bcrypt hash ($2a$12$... → 12). */
export function bcryptCost(hash: string): number {
  const parts = hash.split('$');
  const cost = parseInt(parts[2], 10);
  return Number.isFinite(cost) ? cost : 0;
}

/**
 * Count occurrences of the password in the HIBP "Pwned Passwords" corpus.
 * Uses the range API with SHA-1 k-anonymity — the raw password never
 * leaves the server (only a 5-hex-char prefix of its SHA-1).
 *
 * Returns the number of times the password appears in known breaches
 * (0 = not found / API unreachable → fail-open).
 */
export async function isPwnedPassword(password: string): Promise<number> {
  try {
    const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        signal: controller.signal,
        headers: { 'Add-Padding': 'true' },
      });
      if (!res.ok) return 0; // fail-open on non-2xx
      const body = await res.text();
      for (const line of body.split('\n')) {
        const [hashSuffix, count] = line.trim().split(':');
        if (hashSuffix === suffix) return parseInt(count, 10) || 0;
      }
      return 0;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // Network error / timeout / abort → fail-open (never block on outage)
    return 0;
  }
}