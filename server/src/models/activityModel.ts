/**
 * Activity Model — SQL query functions for the User Activity dashboard.
 *
 * All queries read from the pre-aggregated tables (user_activity_daily,
 * user_activity_hourly, module_access_summary) and the cached columns on
 * the users table for O(1) lookups.  Raw access_logs / login_sessions are
 * only queried for the detailed log endpoints.
 */
import { pool } from './db';
import crypto from 'crypto';

/* ─────────────────────────────────────────────────────────────────
 *  IP Geolocation helper — lightweight, no external API required.
 *  For local/private IPs, returns "Local Network".
 *  For public IPs, a future integration with MaxMind/IP-API can
 *  populate the ip_geolocation table and return "City, Region".
 * ─────────────────────────────────────────────────────────────── */
function isPrivateIP(ip: string): boolean {
  // Strip IPv6-mapped IPv4 prefix
  const clean = ip.replace(/^::ffff:/, '');
  if (clean === '::1' || clean === '127.0.0.1') return true;
  const parts = clean.split('.');
  if (parts.length === 4) {
    const [a, b] = parts.map(Number);
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

async function resolveGeolocation(ip: string | null): Promise<string | null> {
  if (!ip) return null;
  if (isPrivateIP(ip)) return 'Local Network';

  // Check cache in ip_geolocation table
  const [rows] = await pool.query<any[]>(
    'SELECT city, region FROM ip_geolocation WHERE ip_address = ?',
    [ip],
  );
  if (rows.length > 0) {
    const { city, region } = rows[0];
    if (city && region) return `${city}, ${region}`;
    if (city) return city;
    if (region) return region;
  }

  // Not cached — return null for now.
  // A future integration can call an external geolocation API here,
  // cache the result in ip_geolocation, and return the location string.
  return null;
}

export interface ActivitySummary {
  totalAccess: number;
  totalLogins: number;
  uniqueUsers: number;
  avgAccessPerUser: number;
  avgLoginPerUser: number;
  mostActiveUser: string | null;
  mostActiveUserId: string | null;
}

export interface UserModuleStat {
  module: string;
  menuLabel: string;
  totalAccess: number;
}

export interface DetailedUserRow {
  userId: string;
  username: string;
  fullName: string;
  analyticsCategory: string | null;
  totalAccess: number;
  totalLogins: number;
  activeDays: number;
  ipAddress: string | null;
  deviceInfo: string | null;
  geolocation: string | null;
  firstActivityAt: string | null;
  lastActivityAt: string | null;
  status: 'ONLINE' | 'OFFLINE';
  activityLevel: 'SANGAT_AKTIF' | 'AKTIF' | 'CUKUP_AKTIF' | 'KURANG_AKTIF';
  topModules: UserModuleStat[];
}

export interface TrendPoint {
  date: string;
  totalAccess: number;
  totalLogins: number;
}

export interface ModuleStat {
  module: string;
  menuLabel: string;
  menuPath: string;
  totalAccess: number;
  uniqueUsers: number;
}

export interface HeatmapCell {
  dayOfWeek: number;
  hourOfDay: number;
  totalAccess: number;
  totalLogins: number;
  uniqueUsers: number;
}

export interface AccessLogRow {
  id: string;
  userId: string | null;
  username: string | null;
  fullName: string | null;
  actionType: string;
  menuPath: string | null;
  module: string | null;
  method: string | null;
  endpoint: string | null;
  ipAddress: string | null;
  statusCode: number | null;
  durationMs: number | null;
  createdAt: string;
}

export interface LoginSessionRow {
  id: string;
  userId: string;
  username: string;
  fullName: string;
  role: string;
  loginAt: string;
  logoutAt: string | null;
  ipAddress: string | null;
  status: string;
  durationMinutes: number | null;
}

/* ─────────────────────────────────────────────────────────────────
 *  Helper — compute activity level from total access + active days
 * ─────────────────────────────────────────────────────────────── */

function computeActivityLevel(totalAccess: number, activeDays: number): DetailedUserRow['activityLevel'] {
  // Thresholds based on the 30-day window default
  if (totalAccess >= 500 && activeDays >= 15) return 'SANGAT_AKTIF';
  if (totalAccess >= 200 && activeDays >= 10) return 'AKTIF';
  if (totalAccess >= 50 && activeDays >= 5) return 'CUKUP_AKTIF';
  return 'KURANG_AKTIF';
}

/* ─────────────────────────────────────────────────────────────────
 *  1. Summary KPIs  — GET /api/v1/activity/summary
 * ─────────────────────────────────────────────────────────────── */

export async function getActivitySummary(startDate: string, endDate: string): Promise<ActivitySummary> {
  // Total access in date range
  const [[accessRow]] = await pool.query<any[]>(
    `SELECT COALESCE(SUM(total_access), 0) AS total
       FROM user_activity_daily
      WHERE activity_date BETWEEN ? AND ?`,
    [startDate, endDate],
  );
  const totalAccess = Number(accessRow?.total ?? 0);

  // Total logins in date range
  const [[loginRow]] = await pool.query<any[]>(
    `SELECT COALESCE(SUM(total_logins), 0) AS total
       FROM user_activity_daily
      WHERE activity_date BETWEEN ? AND ?`,
    [startDate, endDate],
  );
  const totalLogins = Number(loginRow?.total ?? 0);

  // Unique users with activity in date range
  const [[userRow]] = await pool.query<any[]>(
    `SELECT COUNT(DISTINCT user_id) AS total
       FROM user_activity_daily
      WHERE activity_date BETWEEN ? AND ? AND is_active_day = 1`,
    [startDate, endDate],
  );
  const uniqueUsers = Number(userRow?.total ?? 0);

  // Averages (guard against div-by-zero)
  const avgAccessPerUser = uniqueUsers > 0 ? totalAccess / uniqueUsers : 0;
  const avgLoginPerUser = uniqueUsers > 0 ? totalLogins / uniqueUsers : 0;

  // Most active user (by total_access_count on users table)
  const [[topRow]] = await pool.query<any[]>(
    `SELECT id, full_name
       FROM users
      WHERE total_access_count > 0
      ORDER BY total_access_count DESC
      LIMIT 1`,
  );

  return {
    totalAccess,
    totalLogins,
    uniqueUsers,
    avgAccessPerUser: Math.round(avgAccessPerUser * 100) / 100,
    avgLoginPerUser: Math.round(avgLoginPerUser * 100) / 100,
    mostActiveUser: topRow?.full_name ?? null,
    mostActiveUserId: topRow?.id ?? null,
  };
}

/* ─────────────────────────────────────────────────────────────────
 *  2. Detailed User Table — GET /api/v1/activity/users
 * ─────────────────────────────────────────────────────────────── */

export async function getDetailedUsers(params: {
  startDate: string;
  endDate: string;
  search: string;
  status: string; // 'ALL' | 'ONLINE' | 'OFFLINE'
  activityLevel: string; // 'ALL' | 'SANGAT_AKTIF' | 'AKTIF' | 'CUKUP_AKTIF' | 'KURANG_AKTIF'
  analyticsCategory: string; // 'ALL' | 'INS' | 'GES' | 'PS' | 'Internal'
  page: number;
  pageSize: number;
}): Promise<{ data: DetailedUserRow[]; total: number }> {
  const { startDate, endDate, search, status, activityLevel, analyticsCategory, page, pageSize } = params;
  const offset = (page - 1) * pageSize;

  const where: string[] = ['u.total_access_count > 0'];
  const paramsArr: any[] = [];

  if (search) {
    where.push('(u.full_name LIKE ? OR u.username LIKE ?)');
    paramsArr.push(`%${search}%`, `%${search}%`);
  }

  if (status === 'ONLINE') {
    where.push('u.last_activity_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)');
  } else if (status === 'OFFLINE') {
    where.push('(u.last_activity_at IS NULL OR u.last_activity_at < DATE_SUB(NOW(), INTERVAL 24 HOUR))');
  }

  if (analyticsCategory && analyticsCategory !== 'ALL') {
    where.push('u.analytics_category = ?');
    paramsArr.push(analyticsCategory);
  }

  const whereClause = where.join(' AND ');

  // Count total
  const [[countRow]] = await pool.query<any[]>(
    `SELECT COUNT(*) AS total FROM users u WHERE ${whereClause}`,
    paramsArr,
  );
  const total = Number(countRow?.total ?? 0);

  // Fetch page
  const [rows] = await pool.query<any[]>(
    `SELECT
       u.id            AS user_id,
       u.username,
       u.full_name,
       u.analytics_category,
       u.total_access_count,
       u.total_login_count,
       u.last_ip_address,
       u.last_device_info,
       u.last_geolocation,
       u.first_activity_at,
       u.last_activity_at,
       COALESCE(d.active_days, 0) AS active_days
     FROM users u
     LEFT JOIN (
       SELECT user_id, COUNT(DISTINCT activity_date) AS active_days
         FROM user_activity_daily
        WHERE activity_date BETWEEN ? AND ?
        GROUP BY user_id
     ) d ON u.id = d.user_id
     WHERE ${whereClause}
     ORDER BY u.total_access_count DESC
     LIMIT ? OFFSET ?`,
    [...paramsArr, startDate, endDate, pageSize, offset],
  );

  // ── Fetch per-user module breakdown (grouped by module name) ──
  const userIds = rows.map((r: any) => r.user_id);
  let userModuleMap: Record<string, UserModuleStat[]> = {};

  if (userIds.length > 0) {
    const placeholders = userIds.map(() => '?').join(',');
    const [moduleRows] = await pool.query<any[]>(
      `SELECT
         al.user_id,
         al.module,
         COUNT(*) AS total_access
       FROM access_logs al
       WHERE al.user_id IN (${placeholders})
         AND al.module IS NOT NULL
         AND DATE(al.created_at) BETWEEN ? AND ?
       GROUP BY al.user_id, al.module
       ORDER BY al.user_id, total_access DESC`,
      [...userIds, startDate, endDate],
    );

    // Group by user_id — show ALL modules (up to 6), use module display name
    for (const mr of moduleRows) {
      const uid = mr.user_id;
      if (!userModuleMap[uid]) userModuleMap[uid] = [];
      userModuleMap[uid].push({
        module: mr.module,
        menuLabel: MODULE_DISPLAY_NAMES[mr.module] ?? mr.module,
        totalAccess: Number(mr.total_access ?? 0),
      });
    }
    for (const uid of Object.keys(userModuleMap)) {
      userModuleMap[uid] = userModuleMap[uid].slice(0, 6);
    }
  }

  const data: DetailedUserRow[] = rows.map((r: any) => {
    const totalAccess = Number(r.total_access_count ?? 0);
    const activeDays = Number(r.active_days ?? 0);
    const isOnline = r.last_activity_at && new Date(r.last_activity_at).getTime() >= Date.now() - 24 * 60 * 60 * 1000;

    return {
      userId: r.user_id,
      username: r.username,
      fullName: r.full_name,
      analyticsCategory: r.analytics_category ?? null,
      totalAccess,
      totalLogins: Number(r.total_login_count ?? 0),
      activeDays,
      ipAddress: r.last_ip_address ?? null,
      deviceInfo: r.last_device_info ?? null,
      geolocation: r.last_geolocation ?? null,
      firstActivityAt: r.first_activity_at ?? null,
      lastActivityAt: r.last_activity_at ?? null,
      status: isOnline ? 'ONLINE' : 'OFFLINE',
      activityLevel: computeActivityLevel(totalAccess, activeDays),
      topModules: userModuleMap[r.user_id] ?? [],
    };
  });

  // Filter by activity level in JS (computed field, not in DB)
  const filtered = activityLevel === 'ALL' ? data : data.filter((d) => d.activityLevel === activityLevel);

  return { data: filtered, total: activityLevel === 'ALL' ? total : filtered.length };
}

/* ─────────────────────────────────────────────────────────────────
 *  3. Daily Trend — GET /api/v1/activity/trend
 * ─────────────────────────────────────────────────────────────── */

export async function getTrend(startDate: string, endDate: string): Promise<TrendPoint[]> {
  const [rows] = await pool.query<any[]>(
    `SELECT
       activity_date  AS date,
       SUM(total_access) AS total_access,
       SUM(total_logins) AS total_logins
     FROM user_activity_daily
     WHERE activity_date BETWEEN ? AND ?
     GROUP BY activity_date
     ORDER BY activity_date ASC`,
    [startDate, endDate],
  );

  return rows.map((r: any) => ({
    date: r.date,
    totalAccess: Number(r.total_access ?? 0),
    totalLogins: Number(r.total_logins ?? 0),
  }));
}

/* ─────────────────────────────────────────────────────────────────
 *  4. Module Distribution — GET /api/v1/activity/modules
 *
 *  Queries access_logs directly for real-time data (no aggregation lag).
 *  Groups by module only for a clean donut chart.
 * ─────────────────────────────────────────────────────────────── */

const MODULE_DISPLAY_NAMES: Record<string, string> = {
  settings: 'Settings',
  auth: 'Auth',
  cms: 'CMS',
  indemnity: 'Indemnity',
  managecare: 'Manage Care',
  dashboard: 'Dashboard',
  adscore: 'AdScore',
};

export async function getModuleStats(startDate: string, endDate: string): Promise<ModuleStat[]> {
  const [rows] = await pool.query<any[]>(
    `SELECT
       al.module,
       COUNT(*) AS total_access,
       COUNT(DISTINCT al.user_id) AS unique_users
     FROM access_logs al
     WHERE DATE(al.created_at) BETWEEN ? AND ?
       AND al.module IS NOT NULL
     GROUP BY al.module
     ORDER BY total_access DESC`,
    [startDate, endDate],
  );

  return rows.map((r: any) => ({
    module: r.module,
    menuLabel: MODULE_DISPLAY_NAMES[r.module] ?? r.module,
    menuPath: '',
    totalAccess: Number(r.total_access ?? 0),
    uniqueUsers: Number(r.unique_users ?? 0),
  }));
}

/* ─────────────────────────────────────────────────────────────────
 *  5. Heatmap — GET /api/v1/activity/heatmap
 * ─────────────────────────────────────────────────────────────── */

export async function getHeatmap(startDate: string, endDate: string): Promise<HeatmapCell[]> {
  const [rows] = await pool.query<any[]>(
    `SELECT
       day_of_week,
       hour_of_day,
       SUM(total_access) AS total_access,
       SUM(total_logins) AS total_logins,
       MAX(unique_users)  AS unique_users
     FROM user_activity_hourly
     WHERE activity_date BETWEEN ? AND ?
     GROUP BY day_of_week, hour_of_day
     ORDER BY day_of_week, hour_of_day`,
    [startDate, endDate],
  );

  return rows.map((r: any) => ({
    dayOfWeek: Number(r.day_of_week),
    hourOfDay: Number(r.hour_of_day),
    totalAccess: Number(r.total_access ?? 0),
    totalLogins: Number(r.total_logins ?? 0),
    uniqueUsers: Number(r.unique_users ?? 0),
  }));
}

/* ─────────────────────────────────────────────────────────────────
 *  6. Raw Access Logs — GET /api/v1/activity/logs
 * ─────────────────────────────────────────────────────────────── */

export async function getAccessLogs(params: {
  startDate: string;
  endDate: string;
  search: string;
  page: number;
  pageSize: number;
}): Promise<{ data: AccessLogRow[]; total: number }> {
  const { startDate, endDate, search, page, pageSize } = params;
  const offset = (page - 1) * pageSize;

  const where: string[] = ['created_at BETWEEN ? AND ?'];
  const paramsArr: any[] = [`${startDate} 00:00:00`, `${endDate} 23:59:59`];

  if (search) {
    where.push('(username LIKE ? OR full_name LIKE ? OR menu_path LIKE ? OR endpoint LIKE ?)');
    paramsArr.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  const whereClause = where.join(' AND ');

  const [[countRow]] = await pool.query<any[]>(
    `SELECT COUNT(*) AS total FROM access_logs WHERE ${whereClause}`,
    paramsArr,
  );
  const total = Number(countRow?.total ?? 0);

  const [rows] = await pool.query<any[]>(
    `SELECT id, user_id, username, full_name, action_type, menu_path,
            module, method, endpoint, ip_address, status_code, duration_ms, created_at
     FROM access_logs
     WHERE ${whereClause}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...paramsArr, pageSize, offset],
  );

  const data: AccessLogRow[] = rows.map((r: any) => ({
    id: r.id,
    userId: r.user_id ?? null,
    username: r.username ?? null,
    fullName: r.full_name ?? null,
    actionType: r.action_type,
    menuPath: r.menu_path ?? null,
    module: r.module ?? null,
    method: r.method ?? null,
    endpoint: r.endpoint ?? null,
    ipAddress: r.ip_address ?? null,
    statusCode: r.status_code ?? null,
    durationMs: r.duration_ms ?? null,
    createdAt: r.created_at,
  }));

  return { data, total };
}

/* ─────────────────────────────────────────────────────────────────
 *  7. Login Sessions — GET /api/v1/activity/sessions
 * ─────────────────────────────────────────────────────────────── */

export async function getLoginSessions(params: {
  startDate: string;
  endDate: string;
  search: string;
  page: number;
  pageSize: number;
}): Promise<{ data: LoginSessionRow[]; total: number }> {
  const { startDate, endDate, search, page, pageSize } = params;
  const offset = (page - 1) * pageSize;

  const where: string[] = ['login_at BETWEEN ? AND ?'];
  const paramsArr: any[] = [`${startDate} 00:00:00`, `${endDate} 23:59:59`];

  if (search) {
    where.push('(username LIKE ? OR full_name LIKE ?)');
    paramsArr.push(`%${search}%`, `%${search}%`);
  }

  const whereClause = where.join(' AND ');

  const [[countRow]] = await pool.query<any[]>(
    `SELECT COUNT(*) AS total FROM login_sessions WHERE ${whereClause}`,
    paramsArr,
  );
  const total = Number(countRow?.total ?? 0);

  const [rows] = await pool.query<any[]>(
    `SELECT id, user_id, username, full_name, role, login_at, logout_at,
            ip_address, status, duration_minutes
     FROM login_sessions
     WHERE ${whereClause}
     ORDER BY login_at DESC
     LIMIT ? OFFSET ?`,
    [...paramsArr, pageSize, offset],
  );

  const data: LoginSessionRow[] = rows.map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    username: r.username,
    fullName: r.full_name,
    role: r.role,
    loginAt: r.login_at,
    logoutAt: r.logout_at ?? null,
    ipAddress: r.ip_address ?? null,
    status: r.status,
    durationMinutes: r.duration_minutes ?? null,
  }));

  return { data, total };
}

/* ─────────────────────────────────────────────────────────────────
 *  8. Aggregation — populate pre-aggregated tables from raw logs.
 *
 *     runAggregation(startDate, endDate) processes all access_logs and
 *     login_sessions in the given date range and upserts into:
 *       - user_activity_daily   (per-user daily summary)
 *       - user_activity_hourly  (global hourly heatmap)
 *       - module_access_summary (per-module/menu daily access)
 *
 *     This is called by:
 *       - POST /api/v1/activity/aggregate (manual trigger, admin only)
 *       - Scheduled job (every hour, today's data)
 *       - Backfill script (historical data, all dates)
 * ─────────────────────────────────────────────────────────────── */

export interface AggregationResult {
  date: string;
  dailyRows: number;
  hourlyRows: number;
  moduleRows: number;
}

export async function runAggregation(startDate: string, endDate: string): Promise<AggregationResult[]> {
  // Get all distinct dates that have access_logs or login_sessions in range
  const [dateRows] = await pool.query<any[]>(
    `SELECT DISTINCT DATE(created_at) AS d FROM access_logs
       WHERE DATE(created_at) BETWEEN ? AND ? AND user_id IS NOT NULL
     UNION
     SELECT DISTINCT DATE(login_at) AS d FROM login_sessions
       WHERE DATE(login_at) BETWEEN ? AND ?`,
    [startDate, endDate, startDate, endDate],
  );

  const dates: string[] = dateRows
    .map((r) => r.d)
    .filter(Boolean)
    .sort()
    .map((d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    });

  const results: AggregationResult[] = [];

  for (const targetDate of dates) {
    // ── 8a. access_logs → user_activity_daily (access counts) ──
    await pool.execute(
      `INSERT INTO user_activity_daily
         (id, user_id, username, full_name, activity_date,
          total_access, total_logins, total_exports, menus_accessed, modules_accessed, is_active_day)
       SELECT
         UUID(),
         al.user_id,
         MAX(al.username),
         MAX(COALESCE(al.full_name, u.full_name, al.username)),
         DATE(al.created_at),
         COUNT(*),
         0,
         SUM(CASE WHEN al.action_type = 'export' THEN 1 ELSE 0 END),
         COUNT(DISTINCT al.menu_path),
         COUNT(DISTINCT al.module),
         1
       FROM access_logs al
       LEFT JOIN users u ON u.id = al.user_id
       WHERE DATE(al.created_at) = ? AND al.user_id IS NOT NULL
       GROUP BY al.user_id, DATE(al.created_at)
       ON DUPLICATE KEY UPDATE
         total_access   = VALUES(total_access),
         total_exports  = VALUES(total_exports),
         menus_accessed = VALUES(menus_accessed),
         modules_accessed = VALUES(modules_accessed),
         is_active_day  = 1,
         updated_at     = NOW()`,
      [targetDate],
    );

    // ── 8b. login_sessions → user_activity_daily (login counts) ──
    await pool.execute(
      `INSERT INTO user_activity_daily
         (id, user_id, username, full_name, activity_date,
          total_access, total_logins, total_exports, menus_accessed, modules_accessed, is_active_day)
       SELECT
         UUID(),
         ls.user_id,
         ls.username,
         COALESCE(ls.full_name, u.full_name, ls.username),
         DATE(ls.login_at),
         0,
         COUNT(*),
         0, 0, 0,
         1
      FROM login_sessions ls
      LEFT JOIN users u ON u.id = ls.user_id
      WHERE DATE(ls.login_at) = ?
      GROUP BY ls.user_id, DATE(ls.login_at)
       ON DUPLICATE KEY UPDATE
         total_logins  = VALUES(total_logins),
         is_active_day = 1,
         updated_at    = NOW()`,
      [targetDate],
    );

    // ── 8c. access_logs → user_activity_hourly (heatmap) ──
    await pool.execute(
      `INSERT INTO user_activity_hourly
         (id, activity_date, hour_of_day, day_of_week, total_access, total_logins, unique_users)
       SELECT
         UUID(),
         DATE(al.created_at),
         HOUR(al.created_at),
         DAYOFWEEK(al.created_at) - 1,
         COUNT(*),
         0,
         COUNT(DISTINCT al.user_id)
       FROM access_logs al
       WHERE DATE(al.created_at) = ?
       GROUP BY DATE(al.created_at), HOUR(al.created_at), DAYOFWEEK(al.created_at) - 1
       ON DUPLICATE KEY UPDATE
         total_access = VALUES(total_access),
         unique_users = VALUES(unique_users),
         updated_at   = NOW()`,
      [targetDate],
    );

    // ── 8d. login_sessions → user_activity_hourly (login counts per hour) ──
    await pool.execute(
      `INSERT INTO user_activity_hourly
         (id, activity_date, hour_of_day, day_of_week, total_access, total_logins, unique_users)
       SELECT
         UUID(),
         DATE(ls.login_at),
         HOUR(ls.login_at),
         DAYOFWEEK(ls.login_at) - 1,
         0,
         COUNT(*),
         COUNT(DISTINCT ls.user_id)
       FROM login_sessions ls
       WHERE DATE(ls.login_at) = ?
       GROUP BY DATE(ls.login_at), HOUR(ls.login_at), DAYOFWEEK(ls.login_at) - 1
       ON DUPLICATE KEY UPDATE
         total_logins = VALUES(total_logins),
         updated_at   = NOW()`,
      [targetDate],
    );

    // ── 8e. access_logs → module_access_summary (per module+menu per day) ──
    // Fixed: GROUP BY now includes menu_path to match unique key
    await pool.execute(
      `INSERT INTO module_access_summary
         (id, module, menu_label, menu_path, total_access, unique_users, last_accessed, activity_date)
       SELECT
         UUID(),
         al.module,
         MAX(al.menu_label),
         al.menu_path,
         COUNT(*),
         COUNT(DISTINCT al.user_id),
         MAX(al.created_at),
         DATE(al.created_at)
       FROM access_logs al
       WHERE DATE(al.created_at) = ? AND al.module IS NOT NULL AND al.menu_path IS NOT NULL
       GROUP BY al.module, al.menu_path, DATE(al.created_at)
       ON DUPLICATE KEY UPDATE
         total_access  = VALUES(total_access),
         unique_users  = VALUES(unique_users),
         last_accessed = VALUES(last_accessed),
         updated_at    = NOW()`,
      [targetDate],
    );

    // Count rows for this date
    const [[dailyCount]] = await pool.query<any[]>(
      'SELECT COUNT(*) AS c FROM user_activity_daily WHERE activity_date = ?',
      [targetDate],
    );
    const [[hourlyCount]] = await pool.query<any[]>(
      'SELECT COUNT(*) AS c FROM user_activity_hourly WHERE activity_date = ?',
      [targetDate],
    );
    const [[moduleCount]] = await pool.query<any[]>(
      'SELECT COUNT(*) AS c FROM module_access_summary WHERE activity_date = ?',
      [targetDate],
    );

    results.push({
      date: targetDate,
      dailyRows: Number(dailyCount?.c ?? 0),
      hourlyRows: Number(hourlyCount?.c ?? 0),
      moduleRows: Number(moduleCount?.c ?? 0),
    });
  }

  return results;
}

/* ─────────────────────────────────────────────────────────────────
 *  9. Log Access Event — called by accessLogger middleware
 * ─────────────────────────────────────────────────────────────── */

export async function logAccessEvent(params: {
  userId: string | null;
  username: string | null;
  fullName: string | null;
  role: string | null;
  analyticsCategory?: string | null;
  actionType: string;
  menuPath: string | null;
  menuLabel: string | null;
  module: string | null;
  method: string;
  endpoint: string;
  ipAddress: string | null;
  userAgent: string | null;
  statusCode: number;
  durationMs: number;
  sessionId: string | null;
}): Promise<void> {
  const id = crypto.randomUUID();

  // Resolve full_name + analytics_category from users table if not provided
  // (JWT only has id/username/role)
  let resolvedFullName = params.fullName;
  let resolvedAnalyticsCategory = params.analyticsCategory ?? null;
  if ((!resolvedFullName || !resolvedAnalyticsCategory) && params.userId) {
    const [[userRow]] = await pool.query<any[]>(
      'SELECT full_name, analytics_category FROM users WHERE id = ?',
      [params.userId],
    );
    if (!resolvedFullName) {
      resolvedFullName = userRow?.full_name ?? params.username ?? 'Unknown';
    }
    if (!resolvedAnalyticsCategory) {
      resolvedAnalyticsCategory = userRow?.analytics_category ?? null;
    }
  }

  await pool.execute(
    `INSERT INTO access_logs
       (id, user_id, username, full_name, role, analytics_category, action_type, menu_path,
        menu_label, module, method, endpoint, ip_address, user_agent,
        status_code, duration_ms, session_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.userId,
      params.username,
      resolvedFullName,
      params.role,
      resolvedAnalyticsCategory,
      params.actionType,
      params.menuPath,
      params.menuLabel,
      params.module,
      params.method,
      params.endpoint,
      params.ipAddress,
      params.userAgent,
      params.statusCode,
      params.durationMs,
      params.sessionId,
    ],
  );

  // Update cached columns on users table (fire-and-forget)
  if (params.userId) {
    const geo = await resolveGeolocation(params.ipAddress).catch(() => null);
    await pool.execute(
      `UPDATE users
          SET total_access_count = total_access_count + 1,
              last_activity_at = NOW(),
              last_ip_address = ?,
              last_device_info = ?,
              last_geolocation = COALESCE(?, last_geolocation),
              first_activity_at = COALESCE(first_activity_at, NOW())
        WHERE id = ?`,
      [params.ipAddress, params.userAgent?.substring(0, 255) ?? null, geo, params.userId],
    );
  }
}

/* ─────────────────────────────────────────────────────────────────
 *  9. Log Login Session — called by authController on successful login
 * ─────────────────────────────────────────────────────────────── */

export async function logLoginSession(params: {
  userId: string;
  username: string;
  fullName: string;
  role: string;
  analyticsCategory?: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  tokenHash: string | null;
}): Promise<string> {
  const id = crypto.randomUUID();
  await pool.execute(
    `INSERT INTO login_sessions
       (id, user_id, username, full_name, role, analytics_category, ip_address, user_agent, token_hash, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
    [id, params.userId, params.username, params.fullName, params.role, params.analyticsCategory ?? null, params.ipAddress, params.userAgent, params.tokenHash],
  );

  // Update cached columns on users table
  const geo = await resolveGeolocation(params.ipAddress).catch(() => null);
  await pool.execute(
    `UPDATE users
        SET total_login_count = total_login_count + 1,
            last_login_at = NOW(),
            last_activity_at = NOW(),
            last_ip_address = ?,
            last_device_info = ?,
            last_geolocation = COALESCE(?, last_geolocation),
            first_activity_at = COALESCE(first_activity_at, NOW())
      WHERE id = ?`,
    [params.ipAddress, params.userAgent?.substring(0, 255) ?? null, geo, params.userId],
  );

  return id;
}

/* ─────────────────────────────────────────────────────────────────
 *  10. Log Logout Session — called by authController on logout
 * ─────────────────────────────────────────────────────────────── */

export async function logLogoutSession(tokenHash: string, reason: string = 'user'): Promise<void> {
  await pool.execute(
    `UPDATE login_sessions
        SET logout_at = NOW(),
            status = 'logout',
            logout_reason = ?,
            duration_minutes = TIMESTAMPDIFF(MINUTE, login_at, NOW())
      WHERE token_hash = ? AND status = 'active'`,
    [reason, tokenHash],
  );
}