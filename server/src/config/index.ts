/**
 * Database configuration — MySQL connection pool via mysql2.
 *
 * Auto-detects connection mode based on env:
 *   - DB_SOCKET_PATH terisi  -> Unix socket  (Local XAMPP / Cloud Run)
 *   - DB_SOCKET_PATH kosong  -> TCP          (DB_HOST + DB_PORT)
 *
 * NOTE: gunakan `??` untuk field yang boleh kosong (DB_PASSWORD untuk
 * XAMPP root tanpa password). `||` menganggap "" falsy dan jatuh ke
 * fallback, menyebabkan ER_ACCESS_DENIED_ERROR.
 */
import dotenv from 'dotenv';
dotenv.config();

const env = process.env;

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
  : {
      // ── TCP mode (GCP Cloud SQL public IP / Docker) ──
    host: env.DB_HOST || '10.250.16.5',
      port: Number(env.DB_PORT) || 3306,
    user: env.DB_USER ?? 'bashir',
    password: env.DB_PASSWORD ?? '0xEp8duI*iL(kLJ&',
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

export const jwtConfig = {
  secret: env.JWT_SECRET || 'change-me-to-a-secure-random-string-in-production',
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
 * Falls back to JWT_SECRET if TWO_FACTOR_ENCRYPTION_KEY is not set.
 */
export const twoFactorConfig = {
  encryptionKey: env.TWO_FACTOR_ENCRYPTION_KEY || env.JWT_SECRET || 'change-me-to-a-secure-random-string-in-production',
};

export const port = Number(env.PORT) || 3001;