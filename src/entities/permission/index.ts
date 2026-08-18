/**
 * Permission entity — public API.
 */
export type { PermissionGroup, PermissionAction, RolePermission, UpdatePermissionsPayload } from './model/permissionTypes';
export { permissionApi, useGetPermissionGroupsQuery, useGetRolePermissionsQuery, useUpdatePermissionsMutation } from './api/permissionApi';