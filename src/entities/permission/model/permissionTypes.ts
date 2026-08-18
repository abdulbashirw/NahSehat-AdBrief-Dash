/**
 * CMS Permission types — shared across Permission Management module.
 */

export interface PermissionGroup {
  menu: string;
  label: string;
  actions: PermissionAction[];
}

export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'export';

export interface RolePermission {
  roleId: string;
  roleName: string;
  permissions: {
    menu: string;
    actions: PermissionAction[];
  }[];
}

export interface UpdatePermissionsPayload {
  roleId: string;
  permissions: {
    menu: string;
    actions: PermissionAction[];
  }[];
}