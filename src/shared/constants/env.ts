/**
 * Centralized environment configuration.
 * All env access goes through this module — no raw `import.meta.env` elsewhere.
 */

export const env = {
  /** Backend API base URL (auth, CMS, etc.) */
  beApi: import.meta.env.VITE_BE_API ?? 'https://repi-api-336781009919.asia-southeast2.run.app/api/v1',

  /** NahSehat API v3 base URL (indemnity, manage care data) */
  nahsehatApiV3: import.meta.env.VITE_NAHSEHAT_API_V3 ?? 'https://repi-api-336781009919.asia-southeast2.run.app/api/v3',

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