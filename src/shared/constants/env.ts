/**
 * Centralized environment configuration.
 * All env access goes through this module — no raw `import.meta.env` elsewhere.
 */

/**
 * SECURITY (P3 — L1): TIDAK ada fallback URL internal yang di-hardcode —
 * URL internal membocorkan infrastruktur ke dalam bundle produksi.
 * Env WAJIB disediakan saat build (VITE_BE_API, VITE_NAHSEHAT_API_V3);
 * jika tidak ada → string kosong (relative URL).
 */
export const env = {
  /** Backend API base URL (auth, CMS, etc.) */
  beApi: import.meta.env.VITE_BE_API ?? '',

  /** NahSehat API v3 base URL (indemnity, manage care data) */
  nahsehatApiV3: import.meta.env.VITE_NAHSEHAT_API_V3 ?? '',

  /** Application name */
  appName: import.meta.env.VITE_APP_NAME ?? 'NahSehat Dashboard',

  /** Runtime environment */
  env: import.meta.env.VITE_ENV ?? 'development',

  /** Is production? */
  get isProd(): boolean {
    return this.env === 'production';
  },

  /** Is development? */
  get isDev(): boolean {
    return this.env === 'development';
  },
} as const;