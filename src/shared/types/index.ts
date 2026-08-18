/**
 * Global type definitions for NahSehat Dashboard.
 *
 * These are shared across all modules. Module-specific types
 * live in their respective modules' types/ directories.
 */

/* ─── Role & Permission ─── */

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  INDEMNITY: 'INDEMNITY',
  MANAGECARE: 'MANAGECARE',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export interface Permission {
  id: string;
  menu: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'export';
}

export interface RoleWithPermissions {
  id: string;
  name: Role;
  description: string;
  accessibleMenus: string[];
  permissions: Permission[];
}

/* ─── Auth ─── */

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  phone?: string;
  role: Role;
  permissions: Permission[];
  payorIds: string[];
  isActive: boolean;
  twoFactorEnabled?: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

/** Response when 2FA is required during login. */
export interface TwoFactorRequiredResponse {
  requiresTwoFactor: true;
  tempToken: string;
}

/** Response from 2FA setup — contains QR code + manual entry key. */
export interface TwoFactorSetupResponse {
  secret: string;
  qrCodeUrl: string;
  manualEntry: string;
}

/* ─── API ─── */

export interface ApiResponse<T> {
  data: T;
  message: string;
  statusCode: number;
}

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

/* ─── Sidebar & Navigation ─── */

export interface NavItem {
  key: string;
  label: string;
  icon?: string;
  path: string;
  children?: NavItem[];
  permission?: string;
}

export interface RouteConfig {
  path: string;
  label: string;
  icon?: string;
  roles: Role[];
  children?: RouteConfig[];
}

/* ─── Indemnity (DCSehat) ─── */

/** Claim header record — mirrors the API payload field-for-field.
 *  Dates are `ddmmyyyy` strings (e.g. "17012025"). */
export interface Claim {
  id: number;
  PAYORID: string;
  CLIENTID: string;
  PROVIDERID: string;
  CARDNO: string;
  CLAIMNO: string;
  CLAIMTYPE: string; // "M" (cashless) | "R" (reimbursement)
  STATUS: string;
  POLICYNO: string;
  EMPID: string;
  BRANCH: string;
  MEMBERNO: string;
  NAME: string;
  GENDER: string;
  AGE: string;
  ADMISSIONDATE: string; // ddmmyyyy
  DISCHARGEDATE: string; // ddmmyyyy
  DURATION: string;
  COVERAGEID: string; // GP | DENTAL | LAB | OP | H&S | MAT
  PPLAN: string;
  DISABILITY: string;
  FDIAGNOSIS: string;
  LDIAGNOSIS: string;
  FDIAGNOSISDESC: string;
  RELATIONSHIP: string;
  INCURRED: number;
  APPROVED: number;
  UNAPPROVED: number;
  ASOAPPROVED: number;
  HIGHPLAN: string;
  REMARKS: string;
  EXCESS: number;
  providerName?: string;
  INVOICENO: string;
  HOSPITALINVOICEDATE: string; // ddmmyyyy
  HOSPITALINVOICENO: string;
  RECEIVEDDATE: string; // ddmmyyyy
  SUBMISSIONDATE: string; // ddmmyyyy
  VERIFIEDBY: string;
  PHYSICIANID: string;
  PAYMENTDATE: string;
  created_at: string; // ISO datetime
}

/** Claim line item (benefit detail per CLAIMNO). */
export interface ClaimDetail {
  CLAIMNO: string;
  BENEFITID: string;
  BENEFITDESC: string;
  INCURRED: number;
  APPROVED: number;
  UNAPPROVED: number;
  EXCESS: number;
  REFUND: number;
  PAIDTOPROVIDER: number;
}

/** Provider master record. */
export interface Provider {
  PROVIDERID: string;
  providerName: string;
  type: string; // RS | Klinik | Lab | Klinik Gigi | Apotek
  city: string;
  province: string;
  lat: number;
  lng: number;
  inNetwork: boolean;
}

/** Member master record. */
export interface Member {
  MEMBERNO: string;
  name: string;
  gender: string; // F | M
  birthDate: string; // ddmmyyyy
  relationship: string; // PRINCIPLE | SPOUSE | CHILD
  joinDate: string; // ddmmyyyy
  active: boolean;
  age?: number;
}

export interface Icd10 {
  code: string;
  description: string;
  group: string;
}

export interface ClaimsApiResponse {
  claims: Claim[];
  claimDetails: ClaimDetail[];
  providers: Provider[];
  members: Member[];
  icd10: Icd10[];
}

export const COVERAGE_IDS = ['GP', 'DENTAL', 'LAB', 'OP', 'H&S', 'MAT'] as const;

export const PAYOR_NAMES: Record<string, string> = {
  PAY001: 'AdMedika',
  PAY002: 'Nusantara Sejahtera Insurance',
  PAY003: 'Global Medika Partner',
};

/* ─── Payor ─── */

export type PayorCategory = 'INDEMNITY' | 'MANAGE_CARE';

export interface Payor {
  id: string;
  name: string;
  code: string;
  category: PayorCategory;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ─── Common ─── */

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;