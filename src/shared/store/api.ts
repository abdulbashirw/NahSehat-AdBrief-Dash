/**
 * RTK Query API definition — single base, multiple endpoints.
 *
 * Each domain module injects its own endpoints via `api.injectEndpoints()`.
 * This file sets up the base API with auth header preparation.
 *
 * Since different API domains use different base URLs:
 *   - Auth → VITE_BE_API
 *   - Indemnity → VITE_NAHSEHAT_API_V3
 *   - Manage Care → VITE_NAHSEHAT_API_V3
 *   - CMS → VITE_BE_API
 *
 * Each endpoint provides its full URL path. The baseUrl here is a fallback.
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { LS_TOKEN_KEY } from '@/shared/constants';

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

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: '/',
    prepareHeaders: (headers) => {
      const token = localStorage.getItem(LS_TOKEN_KEY);
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Auth', 'User', 'Role', 'Payor', 'Permission', 'Setting', 'Indemnity', 'ManageCare', 'Activity', 'AdScore'],
  endpoints: () => ({}),
});