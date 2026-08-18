/**
 * Settings controller — app configuration key-value store.
 */
import type { Response, NextFunction } from 'express';
import { pool } from '../models/db';
import { createError } from '../middleware/errorHandler';
import type { AuthRequest } from '../middleware/auth';
import type { AppSettings } from '../types';

/** GET /api/v1/settings/public — public settings for all authenticated users (no role restriction) */
export async function getPublicSettings(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { getSettingBoolean } = await import('../models/settingsModel.js');
    const enableExport = await getSettingBoolean('enableExport', true);
    res.json({ enableExport });
  } catch (err) { next(err); }
}

/** GET /api/v1/settings?category= */
export async function getSettings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { category } = req.query as any;
    const params: any[] = [];
    let where = '1=1';
    if (category) { where += ' AND category = ?'; params.push(category); }

    const [rows] = await pool.query<any[]>(`SELECT * FROM settings WHERE ${where} ORDER BY category, \`key\``, params);

    const data: AppSettings[] = rows.map(r => ({
      id: String(r.id),
      key: r.key,
      value: r.value,
      category: r.category,
      description: r.description,
      updatedAt: r.updated_at,
    }));

    res.json(data);
  } catch (err) { next(err); }
}

/** PUT /api/v1/settings/:id */
export async function updateSetting(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { value } = req.body;

    const [existing] = await pool.execute('SELECT * FROM settings WHERE id = ?', [id]);
    if ((existing as any[]).length === 0) throw createError(404, 'Setting not found');

    await pool.execute('UPDATE settings SET value = ? WHERE id = ?', [value, id]);

    // Invalidate settings cache so new value is picked up immediately
    const { invalidateSettingsCache } = await import('../models/settingsModel.js');
    await invalidateSettingsCache();

    const [rows] = await pool.execute('SELECT * FROM settings WHERE id = ?', [id]);
    const r = (rows as any[])[0];

    res.json({
      id: String(r.id), key: r.key, value: r.value, category: r.category,
      description: r.description, updatedAt: r.updated_at,
    } as AppSettings);
  } catch (err) { next(err); }
}