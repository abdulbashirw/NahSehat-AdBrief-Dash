/**
 * Shared TypeScript types — mirrors frontend types for API contract consistency.
 */

/* ─── Auth ─── */

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  phone?: string;
  role: Role;
  analyticsCategory: AnalyticsCategory | null;
  permissions: Permission[];
  payorIds: string[];
  isActive: boolean;
  twoFactorEnabled?: boolean;
}

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'INDEMNITY' | 'MANAGECARE' | 'ADSCORE';

/** Data analytics category identity — final list: INS | GES | PS | Internal */
export const ANALYTICS_CATEGORIES = ['INS', 'GES', 'PS', 'Internal'] as const;
export type AnalyticsCategory = (typeof ANALYTICS_CATEGORIES)[number];

export interface Permission {
  id: string;
  menu: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'export';
}

export interface LoginRequest {
  name: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

/* ─── Paginated ─── */

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/* ─── Payor ─── */

export type PayorCategory = 'INDEMNITY' | 'MANAGE_CARE';

export interface Payor {
  id: string;
  name: string;
  code: string;
  category: PayorCategory;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePayorPayload {
  name: string;
  code: string;
  category?: PayorCategory;
  description?: string;
  isActive?: boolean;
}

export interface UpdatePayorPayload {
  name?: string;
  code?: string;
  category?: PayorCategory;
  description?: string;
  isActive?: boolean;
}

/* ─── Role ─── */

export interface RoleWithPermissions {
  id: string;
  name: Role;
  description: string;
  accessibleMenus: string[];
  permissions: Permission[];
}

export interface CreateRolePayload {
  name: Role;
  description: string;
  accessibleMenus: string[];
  permissions: { menu: string; action: string }[];
}

export interface UpdateRolePayload {
  name?: Role;
  description?: string;
  accessibleMenus?: string[];
  permissions?: { menu: string; action: string }[];
}

/* ─── Permission ─── */

export interface PermissionGroup {
  menu: string;
  label: string;
  actions: string[];
}

export interface UpdatePermissionsPayload {
  roleId: string;
  permissions: { menu: string; actions: string[] }[];
}

/* ─── Settings ─── */

export interface AppSettings {
  id: string;
  key: string;
  value: string;
  category: string;
  description: string | null;
  updatedAt: string;
}

export interface UpdateSettingRequest {
  id: string;
  value: string;
}

/* ─── User ─── */

export interface CreateUserPayload {
  username: string;
  email: string;
  password: string;
  fullName: string;
  role: Role;
  analyticsCategory: AnalyticsCategory;
  payorIds?: string[];
  isActive?: boolean;
}

export interface UpdateUserPayload {
  fullName?: string;
  email?: string;
  role?: Role;
  analyticsCategory?: AnalyticsCategory;
  payorIds?: string[];
  isActive?: boolean;
}

export interface ResetPasswordPayload {
  newPassword: string;
}

export interface ProfileUpdateRequest {
  fullName?: string;
  email?: string;
  phone?: string;
}

export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
}

/* ─── API Source ─── */

export interface ApiSource {
  id: string;
  name: string;
  base_url: string;
  api_key: string | null;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/* ─── Dashboard KPI ─── */

export interface DashboardKpi {
  totalClaims: number;
  totalIncurred: number;
  totalApproved: number;
  totalMembers: number;
  totalProviders: number;
  claimGrowthRate: number;
  approvalRate: number;
}