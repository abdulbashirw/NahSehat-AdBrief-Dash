/**
 * Payor controller — CRUD for payor management.
 */
import type { Response, NextFunction } from 'express';
import { pool } from '../models/db';
import { createError } from '../middleware/errorHandler';
import type { AuthRequest } from '../middleware/auth';
import type { Payor, PaginatedResponse, CreatePayorPayload, UpdatePayorPayload } from '../types';

/** GET /api/v1/payors?page=&pageSize=&search= */
export async function getPayors(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page = 1, pageSize = 10, search } = req.query as any;
    const offset = (Number(page) - 1) * Number(pageSize);

    let where = '1=1';
    const params: any[] = [];
    if (search) { where += ' AND (name LIKE ? OR code LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

    const [[countRow]] = await pool.query<any[]>(`SELECT COUNT(*) as total FROM payors WHERE ${where}`, params);
    const total = Number(countRow.total);
    const totalPages = Math.ceil(total / Number(pageSize)) || 1;

    const [rows] = await pool.query<any[]>(
      `SELECT * FROM payors WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, Number(pageSize), offset],
    );

    const data: Payor[] = rows.map((r: any) => ({
      id: String(r.id),
      name: r.name,
      code: r.code,
      category: r.category,
      description: r.description,
      isActive: !!r.is_active,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    const result: PaginatedResponse<Payor> = { data, total, page: Number(page), pageSize: Number(pageSize), totalPages };
    res.json(result);
  } catch (err) { next(err); }
}

/** GET /api/v1/payors/:id */
export async function getPayorById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const [rows] = await pool.execute('SELECT * FROM payors WHERE id = ?', [req.params.id]);
    const r = (rows as any[])[0];
    if (!r) throw createError(404, 'Payor not found');

    res.json({
      id: String(r.id), name: r.name, code: r.code, category: r.category, description: r.description,
      isActive: !!r.is_active, createdAt: r.created_at, updatedAt: r.updated_at,
    } as Payor);
  } catch (err) { next(err); }
}

/** POST /api/v1/payors */
export async function createPayor(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, code, category, description, isActive } = req.body as CreatePayorPayload;
    if (!name || !code) throw createError(400, 'name and code are required');

    const [existing] = await pool.execute('SELECT id FROM payors WHERE code = ?', [code]);
    if ((existing as any[]).length > 0) throw createError(409, 'Payor code already exists');

    const payorCategory = category || 'INDEMNITY';
    const id = crypto.randomUUID();
    await pool.execute(
      'INSERT INTO payors (id, name, code, category, description, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, code, payorCategory, description || '', isActive !== false ? 1 : 0],
    );

    const [rows] = await pool.execute('SELECT * FROM payors WHERE id = ?', [id]);
    const r = (rows as any[])[0];

    res.status(201).json({
      id: String(r.id), name: r.name, code: r.code, category: r.category, description: r.description,
      isActive: !!r.is_active, createdAt: r.created_at, updatedAt: r.updated_at,
    } as Payor);
  } catch (err) { next(err); }
}

/** PUT /api/v1/payors/:id */
export async function updatePayor(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const body = req.body as UpdatePayorPayload;

    const [existing] = await pool.execute('SELECT id FROM payors WHERE id = ?', [id]);
    if ((existing as any[]).length === 0) throw createError(404, 'Payor not found');

    const updates: string[] = [];
    const values: any[] = [];
    if (body.name) { updates.push('name = ?'); values.push(body.name); }
    if (body.code) { updates.push('code = ?'); values.push(body.code); }
    if (body.category) { updates.push('category = ?'); values.push(body.category); }
    if (body.description !== undefined) { updates.push('description = ?'); values.push(body.description); }
    if (body.isActive !== undefined) { updates.push('is_active = ?'); values.push(body.isActive ? 1 : 0); }

    if (updates.length > 0) {
      values.push(id);
      await pool.execute(`UPDATE payors SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    const [rows] = await pool.execute('SELECT * FROM payors WHERE id = ?', [id]);
    const r = (rows as any[])[0];

    res.json({
      id: String(r.id), name: r.name, code: r.code, category: r.category, description: r.description,
      isActive: !!r.is_active, createdAt: r.created_at, updatedAt: r.updated_at,
    } as Payor);
  } catch (err) { next(err); }
}

/** DELETE /api/v1/payors/:id */
export async function deletePayor(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const [existing] = await pool.execute('SELECT id FROM payors WHERE id = ?', [req.params.id]);
    if ((existing as any[]).length === 0) throw createError(404, 'Payor not found');

    await pool.execute('DELETE FROM user_payors WHERE payor_id = ?', [req.params.id]);
    await pool.execute('DELETE FROM payors WHERE id = ?', [req.params.id]);

    res.json({ message: 'Payor deleted' });
  } catch (err) { next(err); }
}