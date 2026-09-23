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

// SSL untuk koneksi TCP — server MySQL (Cloud SQL / internal) yang mengaktifkan
// TLS umumnya memakai self-signed cert / CA internal yang TIDAK ada di trust
// store Node.js. Tanpa `ca`, handshake gagal:
//   "unable to verify the first certificate" (HANDSHAKE_SSL_ERROR).
//
// Set DB_SSL=true di env untuk mengaktifkan SSL:
//   DB_SSL=true          → SSL + verifikasi server cert (aman)
//   DB_SSL=no-verify     → SSL tanpa verifikasi cert (testing/self-signed,
//                          masih terenkripsi tapi rentan MITM)
//   tidak di-set         → no SSL (local XAMPP / Docker)
//
// Untuk verifikasi penuh, sediakan CA server MySQL lewat salah satu:
//   DB_SSL_CA       → isi PEM langsung di env (ganti \n baru line)
//   DB_SSL_CA_PATH  → path file .pem di container (direkomendasikan)
// Jika keduanya di-set, DB_SSL_CA_PATH menang.
import fs from 'node:fs';

const sslMode = env.DB_SSL?.trim().toLowerCase();
const sslCaInline = env.DB_SSL_CA?.trim() || undefined;
const sslCaPath = env.DB_SSL_CA_PATH?.trim() || undefined;

function resolveSslCa(): string | undefined {
  if (sslCaPath) {
    try {
      return fs.readFileSync(sslCaPath, 'utf8');
    } catch (err) {
      throw new Error(
        `[config] DB_SSL_CA_PATH is set but the file cannot be read: ${sslCaPath}. ` +
          'Mount the CA certificate into the container or unset DB_SSL_CA_PATH.',
      );
    }
  }
  if (sslCaInline) {
    // Mendukung PEM satu-baris (mis. env var CI/CD): "\n" literal → newline asli.
    return sslCaInline.replace(/\\n/g, '\n');
  }
  return undefined;
}

// TLS protocol knobs (opsional) — untuk server MySQL lama:
//   - MySQL < 5.6.46 / config TLS lama kadang cuma support TLSv1.0/1.1, sedangkan
//     Node 20 default min = TLSv1.2 → handshake gagal:
//     "The server requested an SSL/TLS level that is incompatible with the client
//      SSL/TLS configuration"
//     → set DB_TLS_MIN_VERSION='TLSv1' dan DB_TLS_CIPHERS='DEFAULT@SECLEVEL=0'
//       (OpenSSL 3 menolak cipher TLSv1.0 pada security level default)
//   - Server lama (mis. Aurora MySQL 5.6) bisa gagal negosiasi saat client
//     menawarkan TLSv1.3 → set DB_TLS_MAX_VERSION='TLSv1.2'
// mysql2 meneruskan ketiganya ke tls.createSecureContext (pass-through).
type SslConfig = {
  rejectUnauthorized: boolean;
  ca?: string;
  minVersion?: string;
  maxVersion?: string;
  ciphers?: string;
};

let sslConfig: SslConfig | undefined;
if (sslMode === 'true' || sslMode === 'no-verify') {
  const ca = sslMode === 'true' ? resolveSslCa() : undefined;
  const minVersion = env.DB_TLS_MIN_VERSION?.trim() || undefined;
  const maxVersion = env.DB_TLS_MAX_VERSION?.trim() || undefined;
  const ciphers = env.DB_TLS_CIPHERS?.trim() || undefined;
  sslConfig = {
    rejectUnauthorized: sslMode === 'true',
    ...(ca ? { ca } : {}),
    ...(minVersion ? { minVersion } : {}),
    ...(maxVersion ? { maxVersion } : {}),
    ...(ciphers ? { ciphers } : {}),
  };
}

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

// ── NahSehat API v3 proxy (P1c) ─────────────────────────────────────
// The CMS server proxies whitelisted NahSehat API v3 endpoints so the
// frontend never talks to the external API directly (no internal URLs in
// the bundle, no user JWT leaving our perimeter, payor scoping enforced
// server-side, upstream error bodies sanitized).
//
// Fail-soft: if unset, the proxy endpoints respond 503 but the rest of
// the server keeps working. Set these in server/.env (dev) and
// env.cloud-run.yaml (Cloud Run):
//   NAHSEHAT_API_V3_BASE_URL — e.g. https://api.example.com  (no trailing slash)
//   NAHSEHAT_API_V3_TOKEN    — service token issued by the NahSehat API v3
//                              team (openssl rand -hex 32); validated by
//                              the API v3 side (P1b)
const NAHSEHAT_API_V3_BASE_URL = env.NAHSEHAT_API_V3_BASE_URL?.trim().replace(/\/+$/, '') || '';
const NAHSEHAT_API_V3_TOKEN = env.NAHSEHAT_API_V3_TOKEN?.trim() || '';

if (NAHSEHAT_API_V3_TOKEN.length > 0 && NAHSEHAT_API_V3_TOKEN.length < 32) {
  throw new Error('[config] NAHSEHAT_API_V3_TOKEN is too weak (minimum 32 characters). Generate one with: openssl rand -hex 32');
}

export const nahsehatApiV3Config = {
  baseUrl: NAHSEHAT_API_V3_BASE_URL,
  token: NAHSEHAT_API_V3_TOKEN,
  timeoutMs: Number(env.NAHSEHAT_API_V3_TIMEOUT_MS) || 30_000,
};

