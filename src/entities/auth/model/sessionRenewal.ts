/**
 * Sliding session — keeps long-lived sessions alive while the app is in use.
 *
 * Session strategy (24h JWT + sliding renewal):
 *
 *  - A periodic ping calls GET /auth/validate. If the presented token is
 *    older than half its lifetime, the server responds with `renewedToken`
 *    (see server authController.validateToken) and the client swaps it in
 *    via setCredentials — which also re-arms the expiry timer.
 *  - Hidden tabs are NOT renewed (document.hidden) — an idle background tab
 *    still expires after 24h, matching the product rule "idle → re-login".
 *    Always-visible TV dashboards keep renewing and never log out.
 *
 * The ping is silent: no toast on success, no logout on transient network
 * errors (retried on the next tick). A definitive 401 triggers the same
 * force-logout as the Layer 1 interceptor.
 */
import type { AuthUser } from '@/shared/types';
import { setCredentials } from './authSlice';
import { forceSessionExpiredLogout } from './sessionExpiry';
import { API_URLS } from '@/shared/store/api';

/** How often the renewal ping runs. The renewal threshold is server-side (½ lifetime). */
const RENEW_PING_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

let renewTimer: ReturnType<typeof setInterval> | null = null;

/** Start the periodic renewal ping (no-op if already running). */
export function startSessionRenewalPing(): void {
  if (renewTimer !== null) return;
  renewTimer = setInterval(() => {
    void renewSessionNow();
  }, RENEW_PING_INTERVAL_MS);
}

/** Stop the periodic renewal ping. */
export function stopSessionRenewalPing(): void {
  if (renewTimer !== null) {
    clearInterval(renewTimer);
    renewTimer = null;
  }
}

/**
 * Run one renewal cycle now: validate the current token and swap in a
 * renewed one when the server issues it. Safe to call repeatedly.
 */
export async function renewSessionNow(): Promise<void> {
  // Dynamic import — avoids a static circular dependency with the store
  // (same pattern as sessionExpiry.forceSessionExpiredLogout).
  const { store } = await import('@/shared/store');
  const token = store.getState().auth.token;
  if (!token) {
    stopSessionRenewalPing();
    return;
  }

  // A hidden tab is not "in use" — skip so idle sessions expire naturally.
  if (document.hidden) return;

  try {
    const res = await fetch(`${API_URLS.auth}/validate`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      // Token definitively invalid (expired/revoked) — same path as Layer 1.
      stopSessionRenewalPing();
      void forceSessionExpiredLogout();
      return;
    }
    if (!res.ok) return; // transient error — retry on the next tick

    const data = (await res.json()) as {
      valid?: boolean;
      user?: AuthUser;
      renewedToken?: string;
    };
    if (data.valid && data.user && data.renewedToken) {
      store.dispatch(setCredentials({ token: data.renewedToken, user: data.user }));
    }
  } catch {
    // Network error — keep the session as-is; individual API calls and the
    // expiry timer still cover real failures.
  }
}