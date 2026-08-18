/**
 * User routes — CRUD for user management.
 */
import { Router } from 'express';
import { getUsers, getUserById, createUser, updateUser, deleteUser, toggleUserStatus, resetPassword } from '../controllers/userController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', authorize('SUPER_ADMIN', 'ADMIN'), getUsers);
router.get('/:id', authorize('SUPER_ADMIN', 'ADMIN'), getUserById);
router.post('/', authorize('SUPER_ADMIN'), createUser);
router.put('/:id', authorize('SUPER_ADMIN', 'ADMIN'), updateUser);
router.delete('/:id', authorize('SUPER_ADMIN'), deleteUser);
router.patch('/:id/status', authorize('SUPER_ADMIN'), toggleUserStatus);
router.post('/:id/reset-password', authorize('SUPER_ADMIN'), resetPassword);

export default router;