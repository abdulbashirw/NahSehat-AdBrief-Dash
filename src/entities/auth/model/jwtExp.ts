/**
 * JWT payload helpers — client-side read of the `exp` claim.
 *
 * Only used to schedule the UI auto-logout timer (see sessionExpiry.ts).
 * The signature is NOT verified here and MUST NOT be trusted for access
 * decisions — the server re-validates every token (signature, blacklist,
 * token version) on each request.
 */

/**
 * Decode the `exp` claim (unix seconds) from a JWT.
 * Returns null when the token is malformed or has no numeric `exp`.
 */
export function decodeJwtExp(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    // JWT uses base64url — map to standard base64 and restore padding for atob().
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    const parsed = JSON.parse(json) as { exp?: unknown };

    return typeof parsed.exp === 'number' ? parsed.exp : null;
  } catch {
    return null;
  }
}