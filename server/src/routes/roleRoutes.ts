/**
 * Role routes — CRUD for role management.
 */
import { Router } from 'express';
import { getRoles, getRoleById, createRole, updateRole, deleteRole } from '../controllers/roleController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', authorize('SUPER_ADMIN', 'ADMIN'), getRoles);
router.get('/:id', authorize('SUPER_ADMIN', 'ADMIN'), getRoleById);
router.post('/', authorize('SUPER_ADMIN'), createRole);
router.put('/:id', authorize('SUPER_ADMIN'), updateRole);
router.delete('/:id', authorize('SUPER_ADMIN'), deleteRole);

export default router;