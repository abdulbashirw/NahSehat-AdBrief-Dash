/**
 * Auth routes — login, validate, logout, profile, password change.
 */
import { Router } from 'express';
import { login, validateToken, logout, updateProfile, changePassword } from '../controllers/authController';
import { setup2FA, verify2FA, disable2FA, verify2FALogin } from '../controllers/twoFactorController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.get('/validate', authenticate, validateToken);
router.post('/logout', authenticate, logout);
router.put('/profile', authenticate, updateProfile);
router.post('/change-password', authenticate, changePassword);

// Two-Factor Authentication (TOTP RFC 6238)
router.post('/2fa/setup', authenticate, setup2FA);
router.post('/2fa/verify', authenticate, verify2FA);
router.post('/2fa/disable', authenticate, disable2FA);
router.post('/verify-2fa-login', verify2FALogin);

export default router;