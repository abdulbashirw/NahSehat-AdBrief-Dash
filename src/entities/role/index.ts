/**
 * Role entity — public API.
 */
export type { CreateRolePayload, UpdateRolePayload, PermissionPayload, RoleQueryParams } from './model/roleTypes';
export { roleApi, useGetRolesQuery, useGetRoleByIdQuery, useCreateRoleMutation, useUpdateRoleMutation, useDeleteRoleMutation } from './api/roleApi';