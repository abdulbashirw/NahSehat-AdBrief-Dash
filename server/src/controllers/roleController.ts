/**
 * Role controller — CRUD for role management.
 */
import type { Response, NextFunction } from 'express';
import { pool } from '../models/db';
import { createError } from '../middleware/errorHandler';
import type { AuthRequest } from '../middleware/auth';
import type { RoleWithPermissions, PaginatedResponse, CreateRolePayload, UpdateRolePayload, Role } from '../types';

/** Helper: fetch permissions for a role by role_id (UUID) */
async function getPermissionsByRoleId(roleId: string) {
  const [permRows] = await pool.execute(
    'SELECT id, menu, action FROM role_permissions WHERE role_id = ?',
    [roleId],
  );
  const [menuRows] = await pool.execute(
    'SELECT DISTINCT menu FROM role_permissions WHERE role_id = ?',
    [roleId],
  );
  return {
    permissions: (permRows as any[]).map(p => ({ id: String(p.id), menu: p.menu, action: p.action })),
    accessibleMenus: (menuRows as any[]).map(m => m.menu),
  };
}

/** GET /api/v1/roles?page=&pageSize=&search= */
export async function getRoles(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page = 1, pageSize = 10, search } = req.query as any;
    const offset = (Number(page) - 1) * Number(pageSize);

    let where = '1=1';
    const params: any[] = [];
    if (search) { where += ' AND (r.name LIKE ? OR r.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

    const [[countRow]] = await pool.query<any[]>(`SELECT COUNT(*) as total FROM roles r WHERE ${where}`, params);
    const total = Number(countRow.total);
    const totalPages = Math.ceil(total / Number(pageSize)) || 1;

    const [rows] = await pool.query<any[]>(
      `SELECT r.* FROM roles r WHERE ${where} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
      [...params, Number(pageSize), offset],
    );

    const data: RoleWithPermissions[] = [];
    for (const r of rows) {
      const { permissions, accessibleMenus } = await getPermissionsByRoleId(String(r.id));
      data.push({
        id: String(r.id),
        name: r.name as Role,
        description: r.description,
        accessibleMenus,
        permissions,
      });
    }

    const result: PaginatedResponse<RoleWithPermissions> = { data, total, page: Number(page), pageSize: Number(pageSize), totalPages };
    res.json(result);
  } catch (err) { next(err); }
}

/** GET /api/v1/roles/:id */
export async function getRoleById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const [rows] = await pool.execute('SELECT * FROM roles WHERE id = ?', [req.params.id]);
    const role = (rows as any[])[0];
    if (!role) throw createError(404, 'Role not found');

    const { permissions, accessibleMenus } = await getPermissionsByRoleId(String(role.id));

    res.json({
      id: String(role.id),
      name: role.name as Role,
      description: role.description,
      accessibleMenus,
      permissions,
    });
  } catch (err) { next(err); }
}

/** POST /api/v1/roles */
export async function createRole(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, description, permissions } = req.body as CreateRolePayload;
    if (!name) throw createError(400, 'Role name is required');

    const [existing] = await pool.execute('SELECT id FROM roles WHERE name = ?', [name]);
    if ((existing as any[]).length > 0) throw createError(409, 'Role already exists');

    const id = crypto.randomUUID();
    await pool.execute('INSERT INTO roles (id, name, description) VALUES (?, ?, ?)', [id, name, description || '']);

    // Insert permissions using role_id
    if (permissions && permissions.length > 0) {
      for (const p of permissions) {
        await pool.execute(
          'INSERT INTO role_permissions (id, role_id, menu, action) VALUES (?, ?, ?, ?)',
          [crypto.randomUUID(), id, p.menu, p.action],
        );
      }
    }

    const { permissions: perms, accessibleMenus } = await getPermissionsByRoleId(id);

    res.status(201).json({
      id,
      name: name as Role,
      description: description || '',
      accessibleMenus,
      permissions: perms,
    });
  } catch (err) { next(err); }
}

/** PUT /api/v1/roles/:id */
export async function updateRole(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const body = req.body as UpdateRolePayload;

    const [existing] = await pool.execute('SELECT * FROM roles WHERE id = ?', [id]);
    if ((existing as any[]).length === 0) throw createError(404, 'Role not found');
    const role = (existing as any[])[0];

    const updates: string[] = [];
    const values: any[] = [];
    if (body.description) { updates.push('description = ?'); values.push(body.description); }

    if (updates.length > 0) {
      values.push(id);
      await pool.execute(`UPDATE roles SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    // Update permissions — delete then re-insert
    if (body.permissions) {
      await pool.execute('DELETE FROM role_permissions WHERE role_id = ?', [id]);
      for (const p of body.permissions) {
        await pool.execute(
          'INSERT INTO role_permissions (id, role_id, menu, action) VALUES (?, ?, ?, ?)',
          [crypto.randomUUID(), id, p.menu, p.action],
        );
      }
    }

    const { permissions, accessibleMenus } = await getPermissionsByRoleId(id);

    res.json({
      id: String(role.id),
      name: role.name as Role,
      description: body.description || role.description,
      accessibleMenus,
      permissions,
    });
  } catch (err) { next(err); }
}

/** DELETE /api/v1/roles/:id */
export async function deleteRole(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const [existing] = await pool.execute('SELECT * FROM roles WHERE id = ?', [req.params.id]);
    if ((existing as any[]).length === 0) throw createError(404, 'Role not found');
    const role = (existing as any[])[0];

    if (role.name === 'SUPER_ADMIN') throw createError(403, 'Cannot delete SUPER_ADMIN role');

    await pool.execute('DELETE FROM role_permissions WHERE role_id = ?', [req.params.id]);
    await pool.execute('DELETE FROM roles WHERE id = ?', [req.params.id]);

    res.json({ message: 'Role deleted' });
  } catch (err) { next(err); }
}