/**
 * Permission Management API — RTK Query endpoints with fallback mock data.
 */
import { api, API_URLS } from '@/shared/store/api';
import type { RoleWithPermissions, Role, Permission } from '@/shared/types';
import type { PermissionGroup, UpdatePermissionsPayload, PermissionAction } from '../model/permissionTypes';

const allActions: PermissionAction[] = ['create', 'read', 'update', 'delete', 'export'];

const MOCK_PERMISSION_GROUPS: PermissionGroup[] = [
  { menu: 'dashboard', label: 'Dashboard Overview', actions: allActions },
  { menu: 'indemnity-overview', label: 'Utilization Overview', actions: allActions },
  { menu: 'indemnity-claims-map', label: 'Claims Map', actions: allActions },
  { menu: 'indemnity-demographics', label: 'Demographics', actions: allActions },
  { menu: 'indemnity-diseases', label: 'Diseases Analysis', actions: allActions },
  { menu: 'managecare-daily-monitoring', label: 'Daily Monitoring', actions: allActions },
  { menu: 'cms-users', label: 'User Management', actions: allActions },
  { menu: 'cms-roles', label: 'Role Management', actions: allActions },
  { menu: 'cms-payors', label: 'Payor Management', actions: allActions },
  { menu: 'cms-permissions', label: 'Permission Matrix', actions: allActions },
  { menu: 'settings', label: 'System Settings', actions: allActions },
];

const MOCK_ROLE_PERMISSIONS: Record<string, PermissionAction[]> = {
  dashboard: ['read', 'export'],
  'indemnity-overview': ['read', 'export'],
  'indemnity-claims-map': ['read'],
  'indemnity-demographics': ['read'],
  'indemnity-diseases': ['read'],
  'managecare-daily-monitoring': ['read', 'update'],
  'cms-users': ['create', 'read', 'update', 'delete'],
  'cms-roles': ['create', 'read', 'update'],
  'cms-payors': ['create', 'read', 'update'],
  'cms-permissions': ['read', 'update'],
  settings: ['read', 'update'],
};

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
        return { data: MOCK_PERMISSION_GROUPS };
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

        const permList: Permission[] = Object.entries(MOCK_ROLE_PERMISSIONS).flatMap(([menu, actions], i) =>
          actions.map((action, j) => ({ id: `p_${i}_${j}`, menu, action })),
        );

        return {
          data: {
            id: roleId,
            name: (roleId as Role) || 'ADMIN',
            description: `Permissions for ${roleId}`,
            accessibleMenus: Object.keys(MOCK_ROLE_PERMISSIONS),
            permissions: permList,
          },
        };
      },
      providesTags: (_result, _error, roleId) => [{ type: 'Permission', id: roleId }],
    }),

    updatePermissions: builder.mutation<RoleWithPermissions, UpdatePermissionsPayload>({
      async queryFn({ roleId, permissions }) {
        permissions.forEach((p) => {
          MOCK_ROLE_PERMISSIONS[p.menu] = p.actions;
        });
        const permList: Permission[] = Object.entries(MOCK_ROLE_PERMISSIONS).flatMap(([menu, actions], i) =>
          actions.map((action, j) => ({ id: `p_${i}_${j}`, menu, action })),
        );

        return {
          data: {
            id: roleId,
            name: (roleId as Role) || 'ADMIN',
            description: `Permissions for ${roleId}`,
            accessibleMenus: Object.keys(MOCK_ROLE_PERMISSIONS),
            permissions: permList,
          },
        };
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