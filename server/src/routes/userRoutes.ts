/**
 * User routes — CRUD for user management.
 * SECURITY (P2.2): zod validation on all mutating endpoints.
 */
import { Router } from 'express';
import { getUsers, getUserById, createUser, updateUser, deleteUser, toggleUserStatus, resetPassword } from '../controllers/userController';
import { authenticate, authorize, checkPermission } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validate';
import { createUserSchema, updateUserSchema, resetPasswordSchema, toggleStatusSchema, paginationQuerySchema } from '../schemas';

const router = Router();

router.use(authenticate);

router.get('/', validateQuery(paginationQuerySchema), authorize('SUPER_ADMIN', 'ADMIN'), checkPermission('cms-users', 'read'), getUsers);
router.get('/:id', authorize('SUPER_ADMIN', 'ADMIN'), checkPermission('cms-users', 'read'), getUserById);
router.post('/', validateBody(createUserSchema), authorize('SUPER_ADMIN'), checkPermission('cms-users', 'create'), createUser);
router.put('/:id', validateBody(updateUserSchema), authorize('SUPER_ADMIN', 'ADMIN'), checkPermission('cms-users', 'update'), updateUser);
router.delete('/:id', authorize('SUPER_ADMIN'), checkPermission('cms-users', 'delete'), deleteUser);
router.patch('/:id/status', validateBody(toggleStatusSchema), authorize('SUPER_ADMIN'), checkPermission('cms-users', 'update'), toggleUserStatus);
router.post('/:id/reset-password', validateBody(resetPasswordSchema), authorize('SUPER_ADMIN'), checkPermission('cms-users', 'update'), resetPassword);

export default router;