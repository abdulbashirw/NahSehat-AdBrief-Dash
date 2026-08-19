/**
 * Permission Management API — RTK Query endpoints.
 *
 * All endpoints call the real backend API directly.
 */
import { api, API_URLS } from '@/shared/store/api';
import type { RoleWithPermissions } from '@/shared/types';
import type { PermissionGroup, UpdatePermissionsPayload } from '../model/permissionTypes';

export const permissionApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getPermissionGroups: builder.query<PermissionGroup[], void>({
      async queryFn(_arg, _queryApi, _extraOptions, fetchWithBQ) {
        const result = await fetchWithBQ(`${API_URLS.cms}/permissions/groups`);

        if (result.data) {
          const res = result.data as any;
          if (Array.isArray(res.data) && res.data.length > 0) {
            return { data: res.data };
          }
          if (Array.isArray(res) && res.length > 0) {
            return { data: res };
          }
        }

        if (result.error) {
          return { error: result.error };
        }

        // API returned empty — return empty array
        return { data: [] };
      },
      providesTags: ['Permission'],
    }),

    getRolePermissions: builder.query<RoleWithPermissions, string>({
      async queryFn(roleId, _queryApi, _extraOptions, fetchWithBQ) {
        const result = await fetchWithBQ(`${API_URLS.cms}/permissions/roles/${roleId}`);

        if (result.data) {
          const res = result.data as any;
          if (res && res.permissions) {
            return { data: res as RoleWithPermissions };
          }
        }

        if (result.error) {
          return { error: result.error };
        }

        // API returned empty — return empty permissions object
        return {
          data: {
            id: roleId,
            name: 'ADMIN',
            description: '',
            accessibleMenus: [],
            permissions: [],
          },
        };
      },
      providesTags: (_result, _error, roleId) => [{ type: 'Permission', id: roleId }],
    }),

    updatePermissions: builder.mutation<RoleWithPermissions, UpdatePermissionsPayload>({
      async queryFn({ roleId, permissions }, _queryApi, _extraOptions, fetchWithBQ) {
        const result = await fetchWithBQ({
          url: `${API_URLS.cms}/permissions/roles/${roleId}`,
          method: 'PUT',
          body: { permissions },
        });

        if (result.data) {
          return { data: result.data as RoleWithPermissions };
        }
        return { error: result.error! };
      },
      invalidatesTags: (_result, _error, { roleId }) => [{ type: 'Permission', id: roleId }, 'Permission', 'Role'],
    }),
  }),
});

export const {
  useGetPermissionGroupsQuery,
  useGetRolePermissionsQuery,
  useUpdatePermissionsMutation,
} = permissionApi;