/**
 * Settings model — read setting values from the settings table.
 * Used by backend controllers to enforce application settings.
 */
import { pool } from './db';

/** Cache for settings to avoid querying the DB on every request. */
const settingsCache = new Map<string, string>();
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // refresh cache every 60 seconds

async function refreshCache(): Promise<void> {
  const now = Date.now();
  if (now - cacheTimestamp < CACHE_TTL_MS && settingsCache.size > 0) return;

  const [rows] = await pool.execute('SELECT `key`, value FROM settings');
  settingsCache.clear();
  for (const row of rows as any[]) {
    settingsCache.set(row.key, row.value);
  }
  cacheTimestamp = now;
}

/** Force a cache refresh (call after updating a setting). */
export async function invalidateSettingsCache(): Promise<void> {
  cacheTimestamp = 0;
  await refreshCache();
}

/** Get a setting value as string. Returns undefined if not found. */
export async function getSettingValue(key: string): Promise<string | undefined> {
  await refreshCache();
  return settingsCache.get(key);
}

/** Get a setting value as number. Returns fallback if not found or invalid. */
export async function getSettingNumber(key: string, fallback: number): Promise<number> {
  const val = await getSettingValue(key);
  const num = Number(val);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

/** Get a setting value as boolean. Returns fallback if not found. */
export async function getSettingBoolean(key: string, fallback: boolean): Promise<boolean> {
  const val = await getSettingValue(key);
  if (val === undefined) return fallback;
  return val === 'true' || val === '1';
}