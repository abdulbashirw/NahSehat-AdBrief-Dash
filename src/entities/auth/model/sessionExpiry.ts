/**
 * Session expiry — proactive auto-logout when the JWT reaches its `exp` claim.
 *
 * Part of the expired-session strategy (24h JWT, no refresh — product
 * decision: the user must sign in again):
 *
 *  - Layer 1 (shared/store/api.ts): any 401 on a protected endpoint →
 *    forced logout. Covers an active user whose token expires mid-session.
 *  - Layer 2 (this file): a timer scheduled from the JWT `exp` logs the
 *    user out exactly when the token expires. Covers the idle case where
 *    no API call happens (nothing would ever return 401).
 *
 * The timer intentionally does NOT refresh the session.
 */
import { toast } from 'sonner';
import i18n from '@/shared/i18n/i18n';
import { logout } from './authSlice';
import { decodeJwtExp } from './jwtExp';

/**
 * setTimeout limit (browsers/Node) — delays beyond ~24.8 days overflow and
 * fire immediately, so they are capped. A 24h JWT is far below this.
 */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

let expiryTimer: ReturnType<typeof setTimeout> | null = null;

/** Clear any pending session-expiry timer. */
export function clearSessionExpiryTimer(): void {
  if (expiryTimer !== null) {
    clearTimeout(expiryTimer);
    expiryTimer = null;
  }
}

/**
 * Force-logout for an expired/invalidated session. Safe to call from
 * anywhere (401 interceptor, expiry timer). Idempotent — only the first
 * caller while a session is still active dispatches and shows the toast.
 */
export async function forceSessionExpiredLogout(): Promise<void> {
  // Dynamic import — avoids a static circular dependency with the store
  // (store/index.ts imports the API + listener, which import this file).
  const { store } = await import('@/shared/store');
  if (!store.getState().auth.isAuthenticated) return; // already logged out

  store.dispatch(logout());

  // Drop all cached API data from the ended session so stale data cannot
  // re-appear after the next login.
  const { api } = await import('@/shared/store/api');
  store.dispatch(api.util.resetApiState());

  toast.error(i18n.t('auth.sessionExpiredTitle'), {
    description: i18n.t('auth.sessionExpiredDesc'),
  });
}

/**
 * (Re)schedule the expiry timer from the current auth token.
 *
 * Called on every `setCredentials` (listener middleware) and on app mount
 * when a stored token is restored (AuthInitializer) — the latter covers
 * the case where mount validation fails with a network error and
 * `setCredentials` is never dispatched.
 */
export async function scheduleSessionExpiryTimer(): Promise<void> {
  clearSessionExpiryTimer();

  const { store } = await import('@/shared/store');
  const token = store.getState().auth.token;
  if (!token) return;

  const exp = decodeJwtExp(token);
  if (exp === null) return; // no exp claim — the 401 interceptor still covers this

  const delayMs = exp * 1000 - Date.now();
  if (delayMs <= 0) {
    // Token already expired (e.g. restored from localStorage after sleep).
    void forceSessionExpiredLogout();
    return;
  }

  expiryTimer = setTimeout(() => {
    expiryTimer = null;
    void forceSessionExpiredLogout();
  }, Math.min(delayMs, MAX_TIMEOUT_MS));
}