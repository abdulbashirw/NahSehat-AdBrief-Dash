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

/* ── SECURITY (P2.2): clamp security-relevant settings ──────────────
 * Tanpa ini, SUPER_ADMIN bisa set passwordMinLength=1 (melemahkan
 * policy) atau maxLoginAttempts=0 (lockout DoS / unlimited attempts).
 */
const SETTING_CLAMPS: Record<string, { min: number; max: number }> = {
  passwordMinLength: { min: 8, max: 128 },
  maxLoginAttempts: { min: 3, max: 10 },
  lockoutDurationMinutes: { min: 5, max: 1440 },
};

/** PUT /api/v1/settings/:id */
export async function updateSetting(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { value } = req.body;

    const [existing] = await pool.execute('SELECT * FROM settings WHERE id = ?', [id]);
    const setting = (existing as any[])[0];
    if (!setting) throw createError(404, 'Setting not found');

    const clamp = SETTING_CLAMPS[setting.key];
    if (clamp) {
      const n = Number(value);
      if (!Number.isInteger(n) || n < clamp.min || n > clamp.max) {
        throw createError(400, `${setting.key} must be an integer between ${clamp.min} and ${clamp.max}`);
      }
    }

    await pool.execute('UPDATE settings SET value = ? WHERE id = ?', [value, id]);

    // Invalidate settings cache so new value is picked up immediately
    const { invalidateSettingsCache } = await import('../models/settingsModel.js');
    await invalidateSettingsCache();

    const [rows] = await pool.execute('SELECT * FROM settings WHERE id = ?', [id]);
    const r = (rows as any[])[0];
    // (r guaranteed to exist — we just updated it)

    res.json({
      id: String(r.id), key: r.key, value: r.value, category: r.category,
      description: r.description, updatedAt: r.updated_at,
    } as AppSettings);
  } catch (err) { next(err); }
}