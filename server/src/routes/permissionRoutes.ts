/**
 * Permission routes — permission groups and role permissions.
 */
import { Router } from 'express';
import { getPermissionGroups, getRolePermissions, updatePermissions } from '../controllers/permissionController';
import { authenticate, authorize, checkPermission } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/groups', authorize('SUPER_ADMIN', 'ADMIN'), checkPermission('cms-permissions', 'read'), getPermissionGroups);
router.get('/roles/:roleId', authorize('SUPER_ADMIN', 'ADMIN'), checkPermission('cms-permissions', 'read'), getRolePermissions);
router.put('/roles/:roleId', authorize('SUPER_ADMIN'), checkPermission('cms-permissions', 'update'), updatePermissions);

export default router;