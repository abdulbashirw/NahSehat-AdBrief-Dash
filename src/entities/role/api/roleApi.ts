/**
 * Role Management API — RTK Query endpoints with fallback mock data.
 */
import { api, API_URLS } from '@/shared/store/api';
import type { RoleWithPermissions, PaginatedResponse, Role } from '@/shared/types';
import type { CreateRolePayload, UpdateRolePayload, RoleQueryParams } from '../model/roleTypes';

const defaultPerms = [
  { id: 'p1', menu: 'general', action: 'read' as const },
  { id: 'p2', menu: 'general', action: 'export' as const },
];

const MOCK_ROLES: RoleWithPermissions[] = [
  {
    id: 'ROL001',
    name: 'SUPER_ADMIN',
    description: 'Full unrestricted system access & tenant administration',
    accessibleMenus: ['dashboard', 'indemnity', 'managecare', 'cms', 'settings'],
    permissions: defaultPerms,
  },
  {
    id: 'ROL002',
    name: 'ADMIN',
    description: 'Operational manager with access to Indemnity, Manage Care & CMS Users',
    accessibleMenus: ['dashboard', 'indemnity', 'managecare', 'cms-users', 'cms-payors', 'settings'],
    permissions: defaultPerms,
  },
  {
    id: 'ROL003',
    name: 'INDEMNITY',
    description: 'Specialist focused on claims utilization, demographics & disease analysis',
    accessibleMenus: ['dashboard', 'indemnity', 'settings'],
    permissions: defaultPerms,
  },
  {
    id: 'ROL004',
    name: 'MANAGECARE',
    description: 'Hospital officer monitoring daily admissions, discharges, and inpatient stay',
    accessibleMenus: ['dashboard', 'managecare', 'settings'],
    permissions: defaultPerms,
  },
];

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

        // Fallback to mock data
        let list = [...MOCK_ROLES];
        if (params.search) {
          const q = params.search.toLowerCase();
          list = list.filter(
            (r) => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q),
          );
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
      providesTags: ['Role'],
    }),

    getRoleById: builder.query<RoleWithPermissions, string>({
      query: (id) => `${API_URLS.cms}/roles/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Role', id }],
    }),

    createRole: builder.mutation<RoleWithPermissions, CreateRolePayload>({
      async queryFn(body) {
        const newRole: RoleWithPermissions = {
          id: `ROL${Date.now()}`,
          name: (body.name as Role) || 'ADMIN',
          description: body.description,
          accessibleMenus: body.accessibleMenus,
          permissions: body.permissions.map((p, i) => ({
            id: `p_${i}`,
            menu: p.menu,
            action: p.action,
          })),
        };
        MOCK_ROLES.unshift(newRole);
        return { data: newRole };
      },
      invalidatesTags: ['Role'],
    }),

    updateRole: builder.mutation<RoleWithPermissions, { id: string; body: UpdateRolePayload }>({
      async queryFn({ id, body }) {
        const idx = MOCK_ROLES.findIndex((r) => r.id === id);
        if (idx !== -1) {
          MOCK_ROLES[idx] = {
            ...MOCK_ROLES[idx],
            name: (body.name as Role) ?? MOCK_ROLES[idx].name,
            description: body.description ?? MOCK_ROLES[idx].description,
            accessibleMenus: body.accessibleMenus ?? MOCK_ROLES[idx].accessibleMenus,
            permissions: body.permissions
              ? body.permissions.map((p, i) => ({ id: `p_${i}`, menu: p.menu, action: p.action }))
              : MOCK_ROLES[idx].permissions,
          };
          return { data: MOCK_ROLES[idx] };
        }
        return { error: { status: 404, data: 'Role not found' } };
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Role', id }, 'Role'],
    }),

    deleteRole: builder.mutation<void, string>({
      async queryFn(id) {
        const idx = MOCK_ROLES.findIndex((r) => r.id === id);
        if (idx !== -1) {
          MOCK_ROLES.splice(idx, 1);
        }
        return { data: undefined };
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