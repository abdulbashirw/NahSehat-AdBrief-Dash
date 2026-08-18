/**
 * Database configuration — MySQL connection pool via mysql2.
 */
import dotenv from 'dotenv';
dotenv.config();

export const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'nahsehat_analytics_dash',
  // Only use Unix socket if explicitly set; otherwise fall back to TCP (host/port).
  // Local XAMPP: set DB_SOCKET_PATH in server/.env
  // Cloud Run / Cloud SQL TCP: leave unset, use DB_HOST/DB_PORT
  // Cloud Run / Cloud SQL socket: set DB_SOCKET_PATH=/cloudsql/PROJECT:REGION:INSTANCE
  socketPath: process.env.DB_SOCKET_PATH || undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+07:00',
};

export const jwtConfig = {
  secret: process.env.JWT_SECRET || 'change-me-to-a-secure-random-string-in-production',
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
};

export const corsConfig = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};

export const port = Number(process.env.PORT) || 3001;