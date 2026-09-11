/**
 * MySQL connection pool — mysql2/promise for async/await support.
 */
import mysql from 'mysql2/promise';
import { dbConfig } from '../config';

// mysql2: when socketPath is set it takes priority over host/port
export const pool = mysql.createPool(dbConfig);

/** Test connection on startup */
export async function testConnection(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
    console.log('MySQL connected');
  } finally {
    conn.release();
  }
}