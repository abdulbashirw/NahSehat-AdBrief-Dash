/**
 * RTK Query API definition — single base, multiple endpoints.
 *
 * Each domain module injects its own endpoints via `api.injectEndpoints()`.
 * This file sets up the base API with auth header preparation.
 *
 * Since different API domains use different base URLs:
 *   - Auth → VITE_BE_API
 *   - Indemnity & Manage Care → VITE_BE_API (P1c: proxied server-side)
 *   - CMS → VITE_BE_API
 *   - AdScore → VITE_NAHSEHAT_ADBRIEF_API_V3 (still direct — see P1c report)
 *
 * Each endpoint provides its full URL path. The baseUrl here is a fallback.
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { LS_TOKEN_KEY } from '@/shared/constants';
import { forceSessionExpiredLogout } from '@/entities/auth/model/sessionExpiry';

/**
 * SECURITY (P3 — L1): TIDAK ada lagi fallback URL internal yang di-hardcode.
 * Semua base URL WAJIB disediakan via env saat build (VITE_*). Jika env
 * hilang → string kosong (relative URL), BUKAN URL internal yang
 * membocorkan infrastruktur ke dalam bundle produksi.
 *
 * Pastikan .env.production / pipeline CI selalu set:
 *   VITE_BE_API, VITE_NAHSEHAT_API_V3, VITE_NAHSEHAT_ADBRIEF_API_V3
 */
const warnMissing = (key: string): string => {
  void key;
  return '';
};

export const API_URLS = {
  auth: `${import.meta.env.VITE_BE_API || warnMissing('VITE_BE_API')}/auth`,
  indemnity: import.meta.env.VITE_NAHSEHAT_API_V3 || warnMissing('VITE_NAHSEHAT_API_V3'),
  manageCare: import.meta.env.VITE_NAHSEHAT_API_V3 || warnMissing('VITE_NAHSEHAT_API_V3'),
  adbrief: import.meta.env.VITE_NAHSEHAT_ADBRIEF_API_V3 || warnMissing('VITE_NAHSEHAT_ADBRIEF_API_V3'),
  cms: import.meta.env.VITE_BE_API || warnMissing('VITE_BE_API'),
};

const baseQuery = fetchBaseQuery({
  baseUrl: '/',
  prepareHeaders: (headers) => {
    const token = localStorage.getItem(LS_TOKEN_KEY);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

/**
 * Endpoints where a 401 is a NORMAL auth failure (e.g. wrong password on
 * login, invalid code on 2FA verify) — never force-logout on these.
 */
const PUBLIC_AUTH_PATHS = ['/auth/login', '/auth/validate', '/auth/verify-2fa-login'];

/**
 * Base query with expired-session guard (Layer 1 of the auto-logout
 * strategy, see entities/auth/model/sessionExpiry.ts):
 * a 401 on a protected endpoint means the JWT is expired/revoked —
 * clear the session so ProtectedRoute redirects to /login.
 */
const baseQueryWithAuthGuard: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, queryApi, extraOptions) => {
  const result = await baseQuery(args, queryApi, extraOptions);
  if (result.error?.status === 401) {
    const url = typeof args === 'string' ? args : args.url;
    const isPublicAuth = PUBLIC_AUTH_PATHS.some((path) => url.includes(path));
    if (!isPublicAuth) {
      await forceSessionExpiredLogout();
    }
  }
  return result;
};

export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithAuthGuard,
  tagTypes: ['Auth', 'User', 'Role', 'Payor', 'Permission', 'Setting', 'Indemnity', 'ManageCare', 'Activity', 'AdScore'],
  endpoints: () => ({}),
});