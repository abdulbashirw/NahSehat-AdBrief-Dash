/**
 * Activity entity types — mirrors backend API contract.
 */

/* ─── KPI Summary ─── */

export interface ActivitySummary {
  totalAccess: number;
  totalLogins: number;
  uniqueUsers: number;
  avgAccessPerUser: number;
  avgLoginPerUser: number;
  mostActiveUser: string | null;
  mostActiveUserId: string | null;
}

/* ─── Detailed User Row ─── */

export type ActivityLevel = 'SANGAT_AKTIF' | 'AKTIF' | 'CUKUP_AKTIF' | 'KURANG_AKTIF';
export type OnlineStatus = 'ONLINE' | 'OFFLINE';

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
  status: OnlineStatus;
  activityLevel: ActivityLevel;
  topModules: UserModuleStat[];
}

/* ─── Trend Chart ─── */

export interface TrendPoint {
  date: string;
  totalAccess: number;
  totalLogins: number;
}

/* ─── Module Distribution ─── */

export interface ModuleStat {
  module: string;
  menuLabel: string;
  menuPath: string;
  totalAccess: number;
  uniqueUsers: number;
}

/* ─── Heatmap ─── */

export interface HeatmapCell {
  dayOfWeek: number;
  hourOfDay: number;
  totalAccess: number;
  totalLogins: number;
  uniqueUsers: number;
}

/* ─── Raw Access Logs ─── */

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

/* ─── Login Sessions ─── */

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

/* ─── API Query Params ─── */

export interface ActivityQueryParams {
  days?: number;
  page?: number;
  pageSize?: number;
  search?: string;
  status?: 'ALL' | 'ONLINE' | 'OFFLINE';
  activityLevel?: 'ALL' | ActivityLevel;
  analyticsCategory?: string;
}