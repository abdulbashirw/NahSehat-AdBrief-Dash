/**
 * Database configuration — MySQL connection pool via mysql2.
 *
 * Auto-detects connection mode based on env:
 *   - DB_SOCKET_PATH terisi  -> Unix socket  (Local XAMPP / Cloud Run)
 *   - DB_SOCKET_PATH kosong  -> TCP          (DB_HOST + DB_PORT)
 *
 * SECURITY (P0.3): Tidak ada lagi fallback kredensial/secret yang di-hardcode.
 * Server menolak startup (fail-fast) jika variabel wajib tidak tersedia
 * atau terlalu lemah. Lihat requireEnv() di bawah.
 */
import dotenv from 'dotenv';
dotenv.config();

const env = process.env;

/**
 * Fail-fast env validation.
 * Throws at startup if a required variable is missing or too weak —
 * the server must never run with insecure defaults.
 */
function requireEnv(name: string, opts?: { minLength?: number }): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(
      `[config] Missing required environment variable: ${name}. ` +
        'Refusing to start — no insecure fallbacks are allowed.',
    );
  }
  if (opts?.minLength && value.length < opts.minLength) {
    throw new Error(
      `[config] ${name} is too weak (minimum ${opts.minLength} characters). ` +
        'Generate one with: openssl rand -base64 48',
    );
  }
  return value;
}

// ── Required secrets (validated at startup) ──────────────────────────
const JWT_SECRET = requireEnv('JWT_SECRET', { minLength: 32 });
const TWO_FACTOR_ENCRYPTION_KEY = requireEnv('TWO_FACTOR_ENCRYPTION_KEY', {
  minLength: 32,
});

const socketPath = env.DB_SOCKET_PATH?.trim() || undefined;

// SSL untuk Cloud SQL TCP — Cloud SQL mewajibkan SSL/TLS pada koneksi TCP.
// Set DB_SSL=true di env untuk mengaktifkan.
//   DB_SSL=true      → SSL dengan verifikasi server cert (aman, Cloud SQL)
//   DB_SSL=no-verify → SSL tanpa verifikasi cert (untuk testing/self-signed)
//   tidak di-set     → no SSL (local XAMPP / Docker)
const sslMode = env.DB_SSL?.trim().toLowerCase();
const sslConfig =
  sslMode === 'true' ? { rejectUnauthorized: true } :
  sslMode === 'no-verify' ? { rejectUnauthorized: false } :
  undefined;

export const dbConfig = socketPath
  ? {
      // ── Unix socket mode (Local XAMPP / Cloud Run) ──
      socketPath,
      user: env.DB_USER ?? 'root',
      password: env.DB_PASSWORD ?? '',
      database: env.DB_NAME || 'nahsehat_analytics_dash',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 30000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      timezone: '+07:00',
    }
  : buildTcpConfig();

/**
 * TCP mode (GCP Cloud SQL public IP / Docker).
 * SECURITY: kredensial TIDAK punya fallback — host & user wajib di-set,
 * password wajib untuk host non-loopback (localhost XAMPP dikecualikan
 * agar dev lokal tetap bisa jalan tanpa password root).
 */
function buildTcpConfig() {
  const host = env.DB_HOST?.trim();
  const user = env.DB_USER?.trim();
  const password = env.DB_PASSWORD ?? '';
  const isLoopback =
    host === '127.0.0.1' || host === 'localhost' || host === '::1';

  if (!host) {
    throw new Error('[config] DB_HOST is required when DB_SOCKET_PATH is not set');
  }
  if (!user) {
    throw new Error('[config] DB_USER is required when DB_SOCKET_PATH is not set');
  }
  if (!password && !isLoopback) {
    throw new Error(
      '[config] DB_PASSWORD is required for non-local TCP connections. ' +
        'Refusing to start with an empty database password.',
    );
  }

  return {
    host,
    port: Number(env.DB_PORT) || 3306,
    user,
    password,
    database: env.DB_NAME || 'nahsehat_analytics_dash',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 30000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    timezone: '+07:00',
    ...(sslConfig ? { ssl: sslConfig } : {}),
  };
}

export const jwtConfig = {
  secret: JWT_SECRET,
  expiresIn: env.JWT_EXPIRES_IN || '24h',
};

/**
 * CORS configuration.
 *
 * CORS_ORIGIN supports a comma-separated list of allowed origins.
 * CORS_ALLOW_CLOUD_RUN=true auto-allows any https://*.run.app origin
 * (for Cloud Run deployments). JWT auth still protects all endpoints —
 * CORS is not the security boundary.
 */
export const corsConfig = {
  origins: (env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174,http://localhost:3000,http://localhost:3001')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  allowCloudRun: env.CORS_ALLOW_CLOUD_RUN === 'true',
};

/**
 * 2FA configuration — encryption key for TOTP secrets at rest (AES-256-GCM).
 * SECURITY (P0.3): key wajib terpisah dari JWT_SECRET — tidak ada fallback.
 */
export const twoFactorConfig = {
  encryptionKey: TWO_FACTOR_ENCRYPTION_KEY,
};

export const port = Number(env.PORT) || 3001;