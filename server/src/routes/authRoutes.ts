/**
 * Auth routes — login, validate, logout, profile, password change.
 *
 * SECURITY (P1.1): /login & /verify-2fa-login dilindungi loginLimiter
 * (10 req / 15 menit / IP) sebagai lapisan anti brute-force, di atas
 * account-lockout per-username yang sudah ada.
 * SECURITY (P2.2): semua endpoint mutating divalidasi zod (strict schemas).
 */
import { Router } from 'express';
import {
  login,
  validateToken,
  logout,
  updateProfile,
  changePassword,
  logoutAll,
} from '../controllers/authController';
import { setup2FA, verify2FA, disable2FA, verify2FALogin } from '../controllers/twoFactorController';
import { authenticate } from '../middleware/auth';
import { loginLimiter } from '../middleware/rateLimiter';
import { validateBody } from '../middleware/validate';
import {
  loginSchema,
  changePasswordSchema,
  updateProfileSchema,
  verify2FALoginSchema,
  verify2FASetupSchema,
  disable2FASchema,
} from '../schemas';

const router = Router();

router.post('/login', loginLimiter, validateBody(loginSchema), login);
router.get('/validate', authenticate, validateToken);
router.post('/logout', authenticate, logout);
router.put('/profile', authenticate, validateBody(updateProfileSchema), updateProfile);
router.post('/change-password', authenticate, validateBody(changePasswordSchema), changePassword);
// SECURITY (P1.3): bump token_version → semua device lain langsung logout
router.post('/logout-all', authenticate, logoutAll);

// Two-Factor Authentication (TOTP RFC 6238)
router.post('/2fa/setup', authenticate, setup2FA);
router.post('/2fa/verify', authenticate, validateBody(verify2FASetupSchema), verify2FA);
router.post('/2fa/disable', authenticate, validateBody(disable2FASchema), disable2FA);
router.post('/verify-2fa-login', loginLimiter, validateBody(verify2FALoginSchema), verify2FALogin);

export default router;