/**
 * Database connection — MySQL pool via mysql2.
 */
import mysql from 'mysql2/promise';
import { dbConfig } from './index';

export const pool = mysql.createPool({
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  waitForConnections: dbConfig.waitForConnections,
  connectionLimit: dbConfig.connectionLimit,
  queueLimit: dbConfig.queueLimit,
  timezone: dbConfig.timezone,
});

/** Test the database connection on startup. */
export async function testConnection(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
    console.log('✅ MySQL database connected successfully');
  } finally {
    conn.release();
  }
}