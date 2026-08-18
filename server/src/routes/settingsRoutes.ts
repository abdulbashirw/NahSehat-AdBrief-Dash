/**
 * Settings routes — app configuration key-value store.
 */
import { Router } from 'express';
import { getSettings, getPublicSettings, updateSetting } from '../controllers/settingController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/public', getPublicSettings);
router.get('/', authorize('SUPER_ADMIN', 'ADMIN'), getSettings);
router.put('/:id', authorize('SUPER_ADMIN'), updateSetting);

export default router;