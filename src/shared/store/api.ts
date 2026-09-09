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

export const API_URLS = {
  auth: `${import.meta.env.VITE_BE_API || 'https://repi-api-336781009919.asia-southeast2.run.app/api/v1'}/auth`,
  indemnity: import.meta.env.VITE_NAHSEHAT_API_V3 || 'https://repi-api-336781009919.asia-southeast2.run.app/api/v3',
  manageCare: import.meta.env.VITE_NAHSEHAT_API_V3 || 'https://repi-api-336781009919.asia-southeast2.run.app/api/v3',
  adbrief: import.meta.env.VITE_NAHSEHAT_ADBRIEF_API_V3 || 'https://repi2-server-dev-336781009919.asia-southeast2.run.app/adbrief/nahsehat/api/v3',
  cms: import.meta.env.VITE_BE_API || 'https://repi-api-336781009919.asia-southeast2.run.app/api/v1',
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