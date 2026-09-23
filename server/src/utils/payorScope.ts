/**
 * Payor scope helpers (P1a — LIDOR fix).
 *
 * Non-SUPER_ADMIN users may only access payors assigned to them via the
 * user_payors table. SUPER_ADMIN bypasses all scoping (global admin).
 *
 * Used by:
 *   - payorController (list/get/update scoping)
 *   - indemnity/managecare proxy controllers (payor_code validation)
 */
import { pool } from '../models/db';

/** True if the role is allowed to see ALL payors (no tenant scoping). */
export function bypassesPayorScope(role: string | undefined): boolean {
  return role === 'SUPER_ADMIN';
}

/** True if the payor (by id) is assigned to the user (user_payors table). */
export async function isPayorAssigned(userId: string, payorId: string): Promise<boolean> {
  const [rows] = await pool.execute(
    'SELECT 1 FROM user_payors WHERE user_id = ? AND payor_id = ? LIMIT 1',
    [userId, payorId],
  );
  return (rows as any[]).length > 0;
}

/**
 * True if the payor CODE is assigned to the user.
 * Resolves payors.code → payors.id → user_payors (P1c proxy validation).
 */
export async function isPayorCodeAllowed(userId: string, code: string): Promise<boolean> {
  const [rows] = await pool.execute(
    `SELECT 1 FROM payors p
     JOIN user_payors up ON up.payor_id = p.id
     WHERE p.code = ? AND up.user_id = ? LIMIT 1`,
    [code, userId],
  );
  return (rows as any[]).length > 0;
}

/**
 * SQL fragment restricting `id` (payors.id) to the user's assigned payors.
 * Returns null when no restriction applies (SUPER_ADMIN).
 * Push the returned param into the query params AT THE POSITION where
 * this fragment is appended to the WHERE clause.
 */
export function payorScopeSql(
  role: string | undefined,
  userId: string | undefined,
): { sql: string; param: string } | null {
  if (bypassesPayorScope(role) || !userId) return null;
  return {
    sql: ' AND id IN (SELECT payor_id FROM user_payors WHERE user_id = ?)',
    param: userId,
  };
}