/**
 * Settings routes — app configuration key-value store.
 * SECURITY (P2.2): update divalidasi zod (string, max 500, no control chars).
 */
import { Router } from 'express';
import { getSettings, getPublicSettings, updateSetting } from '../controllers/settingController';
import { authenticate, authorize } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { updateSettingSchema } from '../schemas';

const router = Router();

router.use(authenticate);

router.get('/public', getPublicSettings);
router.get('/', authorize('SUPER_ADMIN', 'ADMIN'), getSettings);
router.put('/:id', validateBody(updateSettingSchema), authorize('SUPER_ADMIN'), updateSetting);

export default router;