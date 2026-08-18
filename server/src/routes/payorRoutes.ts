/**
 * Payor routes — CRUD for payor management.
 */
import { Router } from 'express';
import { getPayors, getPayorById, createPayor, updatePayor, deletePayor } from '../controllers/payorController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', authorize('SUPER_ADMIN', 'ADMIN', 'INDEMNITY'), getPayors);
router.get('/:id', authorize('SUPER_ADMIN', 'ADMIN', 'INDEMNITY'), getPayorById);
router.post('/', authorize('SUPER_ADMIN'), createPayor);
router.put('/:id', authorize('SUPER_ADMIN', 'ADMIN'), updatePayor);
router.delete('/:id', authorize('SUPER_ADMIN'), deletePayor);

export default router;