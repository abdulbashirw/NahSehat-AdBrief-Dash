/**
 * User Management API — RTK Query endpoints.
 *
 * All endpoints call the real backend API directly.
 */
import { api, API_URLS } from '@/shared/store/api';
import type { AuthUser, PaginatedResponse } from '@/shared/types';
import type { CreateUserPayload, UpdateUserPayload, ResetPasswordPayload, UserQueryParams } from '../model/userTypes';

export const userApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getUsers: builder.query<PaginatedResponse<AuthUser>, UserQueryParams>({
      async queryFn(params, _queryApi, _extraOptions, fetchWithBQ) {
        const result = await fetchWithBQ({
          url: `${API_URLS.cms}/users`,
          params: {
            page: params.page,
            pageSize: params.pageSize,
            search: params.search,
            role: params.role,
            isActive: params.isActive,
          },
        });

        if (result.data) {
          const res = result.data as any;
          if (res && res.data && Array.isArray(res.data)) {
            return { data: res as PaginatedResponse<AuthUser> };
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
      providesTags: ['User'],
    }),

    getUserById: builder.query<AuthUser, string>({
      query: (id) => `${API_URLS.cms}/users/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'User', id }],
    }),

    createUser: builder.mutation<AuthUser, CreateUserPayload>({
      async queryFn(body, _queryApi, _extraOptions, fetchWithBQ) {
        const result = await fetchWithBQ({
          url: `${API_URLS.cms}/users`,
          method: 'POST',
          body,
        });

        if (result.data) {
          return { data: result.data as AuthUser };
        }
        return { error: result.error! };
      },
      invalidatesTags: ['User'],
    }),

    updateUser: builder.mutation<AuthUser, { id: string; body: UpdateUserPayload }>({
      async queryFn({ id, body }, _queryApi, _extraOptions, fetchWithBQ) {
        const result = await fetchWithBQ({
          url: `${API_URLS.cms}/users/${id}`,
          method: 'PUT',
          body,
        });

        if (result.data) {
          return { data: result.data as AuthUser };
        }
        return { error: result.error! };
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'User', id }, 'User'],
    }),

    deleteUser: builder.mutation<void, string>({
      async queryFn(id, _queryApi, _extraOptions, fetchWithBQ) {
        const result = await fetchWithBQ({
          url: `${API_URLS.cms}/users/${id}`,
          method: 'DELETE',
        });

        if (result.data || !result.error) {
          return { data: undefined };
        }
        return { error: result.error };
      },
      invalidatesTags: ['User'],
    }),

    resetPassword: builder.mutation<{ message: string }, { id: string; body: ResetPasswordPayload }>({
      async queryFn({ id, body }, _queryApi, _extraOptions, fetchWithBQ) {
        const result = await fetchWithBQ({
          url: `${API_URLS.cms}/users/${id}/reset-password`,
          method: 'POST',
          body,
        });

        if (result.data) {
          return { data: result.data as { message: string } };
        }
        return { error: result.error! };
      },
    }),

    toggleUserStatus: builder.mutation<AuthUser, { id: string; isActive: boolean }>({
      async queryFn({ id, isActive }, _queryApi, _extraOptions, fetchWithBQ) {
        const result = await fetchWithBQ({
          url: `${API_URLS.cms}/users/${id}/status`,
          method: 'PATCH',
          body: { isActive },
        });

        if (result.data) {
          return { data: result.data as AuthUser };
        }
        return { error: result.error! };
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'User', id }, 'User'],
    }),
  }),
});

export const {
  useGetUsersQuery,
  useGetUserByIdQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useResetPasswordMutation,
  useToggleUserStatusMutation,
} = userApi;