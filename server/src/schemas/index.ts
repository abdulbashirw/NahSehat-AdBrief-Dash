/**
 * Zod request schemas (P2.2 / H6) — strict validation for all mutating
 * endpoints + query clamps for resource-consuming reads.
 *
 * Conventions:
 *  - Strings are length-capped everywhere (defense against oversized payloads).
 *  - Passwords enforce the same complexity rules as validatePasswordPolicy
 *    (uppercase, lowercase, number) with min 8 / max 128.
 *  - Enums whitelist known values (role is validated against the DB later,
 *    analyticsCategory & module against these lists).
 */
import { z } from 'zod';

/* ── Shared atoms ─────────────────────────────────────────────────── */

/** Simple RFC-ish email — avoids zod version-specific format APIs. */
const emailAtom = z
  .string()
  .trim()
  .max(120, 'email too long (max 120)')
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'invalid email format');

const passwordAtom = z
  .string()
  .min(8, 'password must be at least 8 characters')
  .max(128, 'password too long (max 128)')
  .regex(/[A-Z]/, 'password must contain an uppercase letter')
  .regex(/[a-z]/, 'password must contain a lowercase letter')
  .regex(/[0-9]/, 'password must contain a number');

const usernameAtom = z
  .string()
  .trim()
  .min(3, 'username must be at least 3 characters')
  .max(50, 'username too long (max 50)')
  .regex(/^[a-zA-Z0-9_.-]+$/, 'username may only contain letters, digits, _, ., -');

const nameAtom = z.string().trim().min(1, 'required').max(100, 'too long (max 100)');

/* ── Auth ─────────────────────────────────────────────────────────── */

export const loginSchema = z.object({
  name: z.string().trim().min(1, 'name required').max(100),
  password: z.string().min(1, 'password required').max(128),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'currentPassword required').max(128),
  newPassword: passwordAtom,
});

export const updateProfileSchema = z
  .object({
    fullName: nameAtom.optional(),
    email: emailAtom.optional(),
    phone: z.string().trim().max(30, 'phone too long (max 30)').optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const verify2FALoginSchema = z.object({
  tempToken: z.string().min(10, 'tempToken required').max(2048),
  token: z.string().regex(/^\d{6}$/, 'token must be a 6-digit code'),
});

export const verify2FASetupSchema = z.object({
  token: z.string().regex(/^\d{6}$/, 'token must be a 6-digit code'),
});

export const disable2FASchema = z.object({
  token: z.string().regex(/^\d{6}$/, 'token must be a 6-digit code'),
  password: z.string().min(1, 'password required').max(128),
});

/* ── Users ────────────────────────────────────────────────────────── */

export const ANALYTICS_CATEGORIES_ENUM = z.enum(['INS', 'GES', 'PS', 'Internal']);

export const createUserSchema = z.object({
  username: usernameAtom,
  email: emailAtom,
  password: passwordAtom,
  fullName: nameAtom,
  role: z.string().trim().min(1, 'role required').max(50),
  analyticsCategory: ANALYTICS_CATEGORIES_ENUM,
  payorIds: z.array(z.string().max(64)).max(100, 'too many payors').optional(),
  isActive: z.boolean().optional(),
});

export const updateUserSchema = z
  .object({
    fullName: nameAtom.optional(),
    email: emailAtom.optional(),
    role: z.string().trim().min(1).max(50).optional(),
    analyticsCategory: ANALYTICS_CATEGORIES_ENUM.optional(),
    isActive: z.boolean().optional(),
    payorIds: z.array(z.string().max(64)).max(100, 'too many payors').optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const resetPasswordSchema = z.object({
  newPassword: passwordAtom,
});

export const toggleStatusSchema = z.object({
  isActive: z.boolean(),
});

/* ── Settings ─────────────────────────────────────────────────────── */

/** Settings values are stored as strings; cap length, reject control chars. */
export const updateSettingSchema = z.object({
  value: z
    .string()
    .max(500, 'value too long (max 500)')
    .regex(/^[^\u0000-\u001f\u007f]*$/, 'control characters not allowed'),
});

/* ── Activity ─────────────────────────────────────────────────────── */

/** Whitelist mirrors FE ROUTE_MODULE_MAP + server accessLogger MODULE_MAP. */
export const ACTIVITY_MODULES = ['indemnity', 'managecare', 'cms', 'adscore', 'settings', 'dashboard', 'auth'] as const;

export const logPageViewSchema = z.object({
  module: z.enum(ACTIVITY_MODULES),
  menuPath: z
    .string()
    .max(200, 'menuPath too long (max 200)')
    .regex(/^\/[a-zA-Z0-9/_-]*$/, 'menuPath must be a route path (letters, digits, /, _, -)'),
  menuLabel: z
    .string()
    .max(100, 'menuLabel too long (max 100)')
    .regex(/^[a-zA-Z0-9 _&'()./-]*$/, 'menuLabel contains disallowed characters')
    .optional(),
});

export const aggregateSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD').optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD').optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be YYYY-MM-DD').optional(),
  })
  .refine((v) => !v.startDate || !!v.endDate, { message: 'endDate required when startDate is provided' });

/* ── Query param clamps (pagination / date range) ─────────────────── */

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100, 'pageSize max 100').default(10),
  search: z.string().max(100, 'search too long (max 100)').optional(),
});

export const activityQuerySchema = paginationQuerySchema.extend({
  days: z.coerce.number().int().min(1).max(365, 'days max 365').default(30),
  status: z.string().max(20).optional(),
  activityLevel: z.string().max(20).optional(),
  analyticsCategory: z.string().max(20).optional(),
});

export const activityLogsQuerySchema = paginationQuerySchema.extend({
  days: z.coerce.number().int().min(1).max(365, 'days max 365').default(30),
  pageSize: z.coerce.number().int().min(1).max(100, 'pageSize max 100').default(20),
});

export const trendQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365, 'days max 365').default(30),
});