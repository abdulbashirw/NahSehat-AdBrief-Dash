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
      timezone: '+07:00',
    }
  : {
      // ── TCP mode (GCP Cloud SQL public IP / Docker) ──
      host: env.DB_HOST || 'localhost',
      port: Number(env.DB_PORT) || 3306,
      user: env.DB_USER ?? 'root',
      password: env.DB_PASSWORD ?? '',
      database: env.DB_NAME || 'nahsehat_analytics_dash',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 30000,
      timezone: '+07:00',
    };

export const jwtConfig = {
  secret: env.JWT_SECRET || 'change-me-to-a-secure-random-string-in-production',
  expiresIn: env.JWT_EXPIRES_IN || '24h',
};

export const corsConfig = {
  origin: env.CORS_ORIGIN || 'http://localhost:5173',
};

export const port = Number(env.PORT) || 3001;