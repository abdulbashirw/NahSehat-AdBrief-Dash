/**
 * Permission controller — permission groups and role permissions.
 */
import type { Response, NextFunction } from 'express';
import { pool } from '../models/db';
import { createError } from '../middleware/errorHandler';
import type { AuthRequest } from '../middleware/auth';
import type { RoleWithPermissions, Role, UpdatePermissionsPayload, PermissionGroup } from '../types';
import { invalidatePermissionCache } from '../middleware/auth';

// Standard known navigation modules with human-readable labels
const STANDARD_MODULES: { menu: string; label: string }[] = [
  { menu: 'dashboard', label: 'Dashboard Overview' },
  { menu: 'indemnity-overview', label: 'Indemnity - Utilization Overview' },
  { menu: 'indemnity-claims-map', label: 'Indemnity - Claims Map' },
  { menu: 'indemnity-demographics', label: 'Indemnity - Demographics' },
  { menu: 'indemnity-diseases', label: 'Indemnity - Diseases' },
  { menu: 'managecare-daily-monitoring', label: 'Manage Care - Daily Monitoring' },
  { menu: 'adscore', label: 'AdScore Analytics' },
  { menu: 'cms-users', label: 'CMS - User Management' },
  { menu: 'cms-roles', label: 'CMS - Role Management' },
  { menu: 'cms-payors', label: 'CMS - Payor Management' },
  { menu: 'cms-permissions', label: 'CMS - Permission Matrix' },
  { menu: 'activity', label: 'CMS - User Activity' },
  { menu: 'settings', label: 'System Settings' },
];

/** GET /api/v1/permissions/groups */
export async function getPermissionGroups(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const [rows] = await pool.execute('SELECT DISTINCT menu FROM role_permissions ORDER BY menu');
    const existingMenus = new Set((rows as any[]).map(r => r.menu));

    // Combine standard modules with any additional custom menus in database
    const allModuleMap = new Map<string, string>();
    STANDARD_MODULES.forEach(m => allModuleMap.set(m.menu, m.label));
    existingMenus.forEach(menu => {
      if (!allModuleMap.has(menu)) {
        allModuleMap.set(menu, menu.replace(/[-_]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()));
      }
    });

    const groups: PermissionGroup[] = Array.from(allModuleMap.entries()).map(([menu, label]) => ({
      menu,
      label,
      actions: ['create', 'read', 'update', 'delete', 'export'] as const,
    }));

    res.json(groups);
  } catch (err) { next(err); }
}

/** GET /api/v1/permissions/roles/:roleId */
export async function getRolePermissions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { roleId } = req.params;

    // roleId can be UUID (roles.id) or role name (e.g. 'ADMIN')
    const [roleRows] = await pool.execute('SELECT * FROM roles WHERE id = ? OR name = ?', [roleId, roleId]);
    if ((roleRows as any[]).length === 0) throw createError(404, 'Role not found');
    const role = (roleRows as any[])[0];

    const [permRows] = await pool.execute(
      'SELECT id, menu, action FROM role_permissions WHERE role_id = ?',
      [String(role.id)],
    );
    const [menuRows] = await pool.execute(
      'SELECT DISTINCT menu FROM role_permissions WHERE role_id = ?',
      [String(role.id)],
    );

    const result: RoleWithPermissions = {
      id: String(role.id),
      name: role.name as Role,
      description: role.description,
      accessibleMenus: (menuRows as any[]).map(m => m.menu),
      permissions: (permRows as any[]).map(p => ({ id: String(p.id), menu: p.menu, action: p.action })),
    };

    res.json(result);
  } catch (err) { next(err); }
}

/** PUT /api/v1/permissions/roles/:roleId */
export async function updatePermissions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { roleId } = req.params;
    const { permissions } = req.body as UpdatePermissionsPayload;

    // roleId can be UUID (roles.id) or role name (e.g. 'ADMIN')
    const [roleRows] = await pool.execute('SELECT * FROM roles WHERE id = ? OR name = ?', [roleId, roleId]);
    if ((roleRows as any[]).length === 0) throw createError(404, 'Role not found');
    const role = (roleRows as any[])[0];

    // Replace all permissions for this role
    await pool.execute('DELETE FROM role_permissions WHERE role_id = ?', [String(role.id)]);

    // SECURITY (P3 / L6): permission berubah → permission cache role ini invalid
    invalidatePermissionCache(String(role.name));

    if (permissions && permissions.length > 0) {
      // Flatten { menu, actions: string[] } into individual rows
      for (const p of permissions) {
        for (const action of p.actions) {
          await pool.execute(
            'INSERT INTO role_permissions (id, role_id, menu, action) VALUES (?, ?, ?, ?)',
            [crypto.randomUUID(), String(role.id), p.menu, action],
          );
        }
      }
    }

    const [permRows] = await pool.execute(
      'SELECT id, menu, action FROM role_permissions WHERE role_id = ?',
      [String(role.id)],
    );
    const [menuRows] = await pool.execute(
      'SELECT DISTINCT menu FROM role_permissions WHERE role_id = ?',
      [String(role.id)],
    );

    const result: RoleWithPermissions = {
      id: String(role.id),
      name: role.name as Role,
      description: role.description,
      accessibleMenus: (menuRows as any[]).map(m => m.menu),
      permissions: (permRows as any[]).map(p => ({ id: String(p.id), menu: p.menu, action: p.action })),
    };

    res.json(result);
  } catch (err) { next(err); }
}