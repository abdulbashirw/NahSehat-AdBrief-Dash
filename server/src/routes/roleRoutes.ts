/**
 * Role routes — CRUD for role management.
 */
import { Router } from 'express';
import { getRoles, getRoleById, createRole, updateRole, deleteRole } from '../controllers/roleController';
import { authenticate, authorize, checkPermission } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', authorize('SUPER_ADMIN', 'ADMIN'), checkPermission('cms-roles', 'read'), getRoles);
router.get('/:id', authorize('SUPER_ADMIN', 'ADMIN'), checkPermission('cms-roles', 'read'), getRoleById);
router.post('/', authorize('SUPER_ADMIN'), checkPermission('cms-roles', 'create'), createRole);
router.put('/:id', authorize('SUPER_ADMIN'), checkPermission('cms-roles', 'update'), updateRole);
router.delete('/:id', authorize('SUPER_ADMIN'), checkPermission('cms-roles', 'delete'), deleteRole);

export default router;