/**
 * CMS Role types — shared across Role Management module.
 */

export interface CreateRolePayload {
  name: string;
  description: string;
  accessibleMenus: string[];
  permissions: PermissionPayload[];
}

export interface UpdateRolePayload {
  name?: string;
  description?: string;
  accessibleMenus?: string[];
  permissions?: PermissionPayload[];
}

export interface PermissionPayload {
  menu: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'export';
}

export interface RoleQueryParams {
  page: number;
  pageSize: number;
  search?: string;
}