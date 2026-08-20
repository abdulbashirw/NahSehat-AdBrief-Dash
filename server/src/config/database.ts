/**
 * Database connection — MySQL pool via mysql2.
 */
import mysql from 'mysql2/promise';
import { dbConfig } from './index';

// Use the full dbConfig (including socketPath) so this pool behaves
// identically to the pool in models/db.ts. Without socketPath, Cloud Run
// with Cloud SQL Unix socket would fail at startup testConnection().
export const pool = mysql.createPool(dbConfig);

/** Test the database connection on startup. */
export async function testConnection(): Promise<void> {
  try {
    const conn = await pool.getConnection();
    try {
      await conn.ping();
      console.log('✅ MySQL database connected successfully');
    } finally {
      conn.release();
    }
  } catch (err: any) {
    // Log detail error MySQL agar mudah diagnosa saat deploy.
    const detail = {
      code: err?.code,
      errno: err?.errno,
      sqlState: err?.sqlState,
      sqlMessage: err?.sqlMessage,
      message: err?.message,
    };
    console.error('❌ MySQL connection failed:', JSON.stringify(detail, null, 2));
    throw err;
  }
}