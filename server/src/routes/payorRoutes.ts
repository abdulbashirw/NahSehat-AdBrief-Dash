/**
 * Payor routes — CRUD for payor management.
 */
import { Router } from 'express';
import { getPayors, getPayorById, createPayor, updatePayor, deletePayor } from '../controllers/payorController';
import { authenticate, authorize, checkPermission } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', authorize('SUPER_ADMIN', 'ADMIN', 'INDEMNITY', 'MANAGECARE'), getPayors);
router.get('/:id', authorize('SUPER_ADMIN', 'ADMIN', 'INDEMNITY', 'MANAGECARE'), getPayorById);
router.post('/', authorize('SUPER_ADMIN'), checkPermission('cms-payors', 'create'), createPayor);
router.put('/:id', authorize('SUPER_ADMIN', 'ADMIN'), checkPermission('cms-payors', 'update'), updatePayor);
router.delete('/:id', authorize('SUPER_ADMIN'), checkPermission('cms-payors', 'delete'), deletePayor);

export default router;