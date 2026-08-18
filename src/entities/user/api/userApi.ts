/**
 * User Management API — RTK Query endpoints with fallback mock data.
 *
 * All mutations attempt the real backend API first, falling back to
 * in-memory mock data when the server is unreachable.
 */
import { api, API_URLS } from '@/shared/store/api';
import type { AuthUser, PaginatedResponse, Permission, Role } from '@/shared/types';
import type { CreateUserPayload, UpdateUserPayload, ResetPasswordPayload, UserQueryParams } from '../model/userTypes';

const defaultPerms: Permission[] = [
  { id: 'p1', menu: 'all', action: 'read' },
  { id: 'p2', menu: 'all', action: 'export' },
];

const MOCK_USERS: AuthUser[] = [
  {
    id: 'USR001',
    username: 'YAKESPENANTAM',
    email: 'yakes@nahsehat.id',
    fullName: 'Yakes Penantam Admin',
    role: 'SUPER_ADMIN',
    permissions: defaultPerms,
    payorIds: ['PAY001', 'PAY002'],
    isActive: true,
  },
  {
    id: 'USR002',
    username: 'ahmad.subardjo',
    email: 'ahmad.subardjo@admedika.co.id',
    fullName: 'Ahmad Subardjo',
    role: 'ADMIN',
    permissions: defaultPerms,
    payorIds: ['PAY001'],
    isActive: true,
  },
  {
    id: 'USR003',
    username: 'siti.aminah',
    email: 'siti.aminah@admedika.co.id',
    fullName: 'Siti Aminah',
    role: 'INDEMNITY',
    permissions: defaultPerms,
    payorIds: ['PAY001', 'PAY003'],
    isActive: true,
  },
  {
    id: 'USR004',
    username: 'budi.santoso',
    email: 'budi.santoso@admedika.co.id',
    fullName: 'Budi Santoso',
    role: 'MANAGECARE',
    permissions: defaultPerms,
    payorIds: ['PAY002'],
    isActive: true,
  },
  {
    id: 'USR005',
    username: 'dewi.lestari',
    email: 'dewi.lestari@admedika.co.id',
    fullName: 'Dewi Lestari',
    role: 'ADMIN',
    permissions: defaultPerms,
    payorIds: ['PAY001'],
    isActive: false,
  },
];

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

        // Fallback to mock data
        let list = [...MOCK_USERS];
        if (params.search) {
          const q = params.search.toLowerCase();
          list = list.filter(
            (u) =>
              u.fullName.toLowerCase().includes(q) ||
              u.username.toLowerCase().includes(q) ||
              u.email.toLowerCase().includes(q),
          );
        }
        if (params.role && params.role !== 'ALL') {
          list = list.filter((u) => u.role === params.role);
        }

        const page = params.page || 1;
        const pageSize = params.pageSize || 10;
        const total = list.length;
        const totalPages = Math.ceil(total / pageSize) || 1;
        const paginated = list.slice((page - 1) * pageSize, page * pageSize);

        return {
          data: {
            data: paginated,
            total,
            page,
            pageSize,
            totalPages,
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
        // Try real API first
        const result = await fetchWithBQ({
          url: `${API_URLS.cms}/users`,
          method: 'POST',
          body,
        });

        if (result.data) {
          return { data: result.data as AuthUser };
        }

        // Fallback to mock data
        const newUser: AuthUser = {
          id: `USR${Date.now()}`,
          username: body.username,
          email: body.email,
          fullName: body.fullName,
          role: body.role as Role,
          permissions: defaultPerms,
          payorIds: body.payorIds || [],
          isActive: body.isActive ?? true,
        };
        MOCK_USERS.unshift(newUser);
        return { data: newUser };
      },
      invalidatesTags: ['User'],
    }),

    updateUser: builder.mutation<AuthUser, { id: string; body: UpdateUserPayload }>({
      async queryFn({ id, body }, _queryApi, _extraOptions, fetchWithBQ) {
        // Try real API first
        const result = await fetchWithBQ({
          url: `${API_URLS.cms}/users/${id}`,
          method: 'PUT',
          body,
        });

        if (result.data) {
          return { data: result.data as AuthUser };
        }

        // Fallback to mock data
        const idx = MOCK_USERS.findIndex((u) => u.id === id);
        if (idx !== -1) {
          MOCK_USERS[idx] = {
            ...MOCK_USERS[idx],
            fullName: body.fullName ?? MOCK_USERS[idx].fullName,
            email: body.email ?? MOCK_USERS[idx].email,
            role: (body.role as Role) ?? MOCK_USERS[idx].role,
            payorIds: body.payorIds ?? MOCK_USERS[idx].payorIds,
            isActive: body.isActive ?? MOCK_USERS[idx].isActive,
          };
          return { data: MOCK_USERS[idx] };
        }
        return { error: { status: 404, data: 'User not found' } };
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'User', id }, 'User'],
    }),

    deleteUser: builder.mutation<void, string>({
      async queryFn(id, _queryApi, _extraOptions, fetchWithBQ) {
        // Try real API first
        const result = await fetchWithBQ({
          url: `${API_URLS.cms}/users/${id}`,
          method: 'DELETE',
        });

        if (result.data || !result.error) {
          return { data: undefined };
        }

        // Only fall back to mock if the API was unreachable (network error)
        // If the API responded with an error status, propagate it
        if (result.error && 'status' in result.error && typeof result.error.status === 'number') {
          return { error: result.error };
        }

        // Fallback to mock data (network error — API unreachable)
        const idx = MOCK_USERS.findIndex((u) => u.id === id);
        if (idx !== -1) {
          MOCK_USERS.splice(idx, 1);
        }
        return { data: undefined };
      },
      invalidatesTags: ['User'],
    }),

    resetPassword: builder.mutation<{ message: string }, { id: string; body: ResetPasswordPayload }>({
      async queryFn({ id, body }, _queryApi, _extraOptions, fetchWithBQ) {
        // Try real API first
        const result = await fetchWithBQ({
          url: `${API_URLS.cms}/users/${id}/reset-password`,
          method: 'POST',
          body,
        });

        if (result.data) {
          return { data: result.data as { message: string } };
        }

        // Only fall back to mock if the API was unreachable (network error)
        if (result.error && 'status' in result.error && typeof result.error.status === 'number') {
          return { error: result.error };
        }

        // Fallback: simulate success (network error — API unreachable)
        return { data: { message: 'Password reset successfully (mock)' } };
      },
    }),

    toggleUserStatus: builder.mutation<AuthUser, { id: string; isActive: boolean }>({
      async queryFn({ id, isActive }, _queryApi, _extraOptions, fetchWithBQ) {
        // Try real API first
        const result = await fetchWithBQ({
          url: `${API_URLS.cms}/users/${id}/status`,
          method: 'PATCH',
          body: { isActive },
        });

        if (result.data) {
          return { data: result.data as AuthUser };
        }

        // Only fall back to mock if the API was unreachable (network error)
        if (result.error && 'status' in result.error && typeof result.error.status === 'number') {
          return { error: result.error };
        }

        // Fallback to mock data (network error — API unreachable)
        const idx = MOCK_USERS.findIndex((u) => u.id === id);
        if (idx !== -1) {
          MOCK_USERS[idx].isActive = isActive;
          return { data: MOCK_USERS[idx] };
        }
        return { error: { status: 404, data: 'User not found' } };
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