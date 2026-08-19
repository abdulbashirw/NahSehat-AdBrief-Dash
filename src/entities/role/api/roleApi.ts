/**
 * Role Management API — RTK Query endpoints.
 *
 * All endpoints call the real backend API directly.
 */
import { api, API_URLS } from '@/shared/store/api';
import type { RoleWithPermissions, PaginatedResponse } from '@/shared/types';
import type { CreateRolePayload, UpdateRolePayload, RoleQueryParams } from '../model/roleTypes';

export const roleApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getRoles: builder.query<PaginatedResponse<RoleWithPermissions>, RoleQueryParams>({
      async queryFn(params, _queryApi, _extraOptions, fetchWithBQ) {
        const result = await fetchWithBQ({
          url: `${API_URLS.cms}/roles`,
          params: {
            page: params.page,
            pageSize: params.pageSize,
            search: params.search,
          },
        });

        if (result.data) {
          const res = result.data as any;
          if (res && res.data && Array.isArray(res.data)) {
            return { data: res as PaginatedResponse<RoleWithPermissions> };
          }
        }

        if (result.error) {
          return { error: result.error };
        }

        // API returned empty — return empty paginated response
        return {
          data: {
            data: [],
            total: 0,
            page: params.page || 1,
            pageSize: params.pageSize || 10,
            totalPages: 1,
          },
        };
      },
      providesTags: ['Role'],
    }),

    getRoleById: builder.query<RoleWithPermissions, string>({
      query: (id) => `${API_URLS.cms}/roles/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Role', id }],
    }),

    createRole: builder.mutation<RoleWithPermissions, CreateRolePayload>({
      async queryFn(body, _queryApi, _extraOptions, fetchWithBQ) {
        const result = await fetchWithBQ({
          url: `${API_URLS.cms}/roles`,
          method: 'POST',
          body,
        });

        if (result.data) {
          return { data: result.data as RoleWithPermissions };
        }
        return { error: result.error! };
      },
      invalidatesTags: ['Role'],
    }),

    updateRole: builder.mutation<RoleWithPermissions, { id: string; body: UpdateRolePayload }>({
      async queryFn({ id, body }, _queryApi, _extraOptions, fetchWithBQ) {
        const result = await fetchWithBQ({
          url: `${API_URLS.cms}/roles/${id}`,
          method: 'PUT',
          body,
        });

        if (result.data) {
          return { data: result.data as RoleWithPermissions };
        }
        return { error: result.error! };
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Role', id }, 'Role'],
    }),

    deleteRole: builder.mutation<void, string>({
      async queryFn(id, _queryApi, _extraOptions, fetchWithBQ) {
        const result = await fetchWithBQ({
          url: `${API_URLS.cms}/roles/${id}`,
          method: 'DELETE',
        });

        if (result.data || !result.error) {
          return { data: undefined };
        }
        return { error: result.error };
      },
      invalidatesTags: ['Role'],
    }),
  }),
});

export const {
  useGetRolesQuery,
  useGetRoleByIdQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
} = roleApi;