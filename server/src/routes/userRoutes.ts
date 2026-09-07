/**
 * User routes — CRUD for user management.
 */
import { Router } from 'express';
import { getUsers, getUserById, createUser, updateUser, deleteUser, toggleUserStatus, resetPassword } from '../controllers/userController';
import { authenticate, authorize, checkPermission } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', authorize('SUPER_ADMIN', 'ADMIN'), checkPermission('cms-users', 'read'), getUsers);
router.get('/:id', authorize('SUPER_ADMIN', 'ADMIN'), checkPermission('cms-users', 'read'), getUserById);
router.post('/', authorize('SUPER_ADMIN'), checkPermission('cms-users', 'create'), createUser);
router.put('/:id', authorize('SUPER_ADMIN', 'ADMIN'), checkPermission('cms-users', 'update'), updateUser);
router.delete('/:id', authorize('SUPER_ADMIN'), checkPermission('cms-users', 'delete'), deleteUser);
router.patch('/:id/status', authorize('SUPER_ADMIN'), checkPermission('cms-users', 'update'), toggleUserStatus);
router.post('/:id/reset-password', authorize('SUPER_ADMIN'), checkPermission('cms-users', 'update'), resetPassword);

export default router;