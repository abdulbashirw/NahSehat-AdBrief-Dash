/**
 * Auth entity — public API.
 *
 * Re-exports everything other slices need from the auth domain.
 */
export { useAuth } from './model/useAuth';
export { useHasRole, useHasAnyRole, useHasPermission, useCheckPermission, usePermissions, useCanAccess, useCanAccessCallback } from './model/useRbac';
export type { PermissionAction } from './model/useRbac';
export type { AuthState } from './model/authSlice';
export { setCredentials, logout, setAuthLoading, setAuthError, updateUser } from './model/authSlice';
export { authApi, useLoginMutation, useValidateTokenQuery, useLogoutMutation } from './api/authApi';