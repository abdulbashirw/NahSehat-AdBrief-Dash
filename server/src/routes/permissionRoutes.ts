/**
 * Permission routes — permission groups and role permissions.
 */
import { Router } from 'express';
import { getPermissionGroups, getRolePermissions, updatePermissions } from '../controllers/permissionController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/groups', authorize('SUPER_ADMIN', 'ADMIN'), getPermissionGroups);
router.get('/roles/:roleId', authorize('SUPER_ADMIN', 'ADMIN'), getRolePermissions);
router.put('/roles/:roleId', authorize('SUPER_ADMIN'), updatePermissions);

export default router;