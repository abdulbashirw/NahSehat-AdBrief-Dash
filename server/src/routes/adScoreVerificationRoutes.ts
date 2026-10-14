/**
 * AdScore Verification Routes — mounted at /api/v1/adscore.
 *
 * CLIENT surface (role ADSCORE / ADMIN / SUPER_ADMIN):
 *   POST /onboarding/submit      → { jobId }
 *   GET  /onboarding/jobs        → active jobs belonging to the authenticated submitter
 *   GET  /onboarding/:jobId      → { job: { status, timeline, result } }  (owner or privileged)
 *   GET  /onboarding/search      → { found, member?, total }
 *
 * VERIFIER surface (role ADSCORE_VERIFIER / ADMIN / SUPER_ADMIN):
 *   GET  /verification/jobs                    → { jobs }
 *   GET  /verification/audit?jobId=            → { entries }
 *   POST /verification/jobs/:id/claim          → { job } (409 if claimed by another)
 *   POST /verification/jobs/:id/consent-check  → { fileId, checked } → { job }
 *   POST /verification/jobs/:id/consent-row    → { rowId, state, fileIds?, note? } → { job }
 *                                                (strict per-member consent, mode bulk)
 *   POST /verification/jobs/:id/match          → { memberId, rowId? } → { job }
 *   POST /verification/jobs/:id/reject         → { reason } → { job }
 *   POST /verification/jobs/:id/request-fix    → { category, note } → { job }
 *   POST /verification/jobs/:id/verify         → { job } (422 if bulk unresolved)
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { extname } from 'node:path';
import { authenticate, authorize } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { proxyLimiter } from '../middleware/rateLimiter';
import { checkMemberRequestSchema, memberCardInfoRequestSchema } from '../schemas';
import {
  getVerificationJobs,
  postClaimJob,
  postConsentCheck,
  postConsentRow,
  postMatch,
  postReject,
  postRequestFix,
  postVerify,
  postCancelJob,
  postUnclaimJob,
  getAudit,
  postCheckMember,
  postMemberCardInfo,
  postMemberCardClaims,
  postMemberCardDisease,
  postMemberCardMonthly,
  postMemberCardRiskInsights,
  postMemberCardRecPlan,
  postCheckMemberPreview,
  postOnboardingSubmit,
  postOnboardingCancel,
  getOnboardingJobStatus,
  getOnboardingJobs,
  getMemberSearch,
  getVerificationConsentFile,
  getOnboardingTemplate,
  getOnboardingFailedRowsTemplate,
} from '../controllers/adScoreVerificationController';

const router = Router();
const consentMimeByExtension: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};
const workbookMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const parseOnboardingFiles = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 6 },
  fileFilter: (_req, file, callback) => {
    const extension = extname(file.originalname).toLowerCase();
    const expectedMime = file.fieldname === 'memberFile' ? workbookMime : consentMimeByExtension[extension];
    const valid = file.fieldname === 'memberFile'
      ? extension === '.xlsx' && file.mimetype === workbookMime
      : file.fieldname === 'consentFiles' && !!expectedMime && expectedMime === file.mimetype;
    if (valid) callback(null, true);
    else callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
  },
}).fields([{ name: 'memberFile', maxCount: 1 }, { name: 'consentFiles', maxCount: 5 }]);

function onboardingUpload(req: Request, res: Response, next: NextFunction): void {
  parseOnboardingFiles(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === 'LIMIT_FILE_SIZE';
      res.status(tooLarge ? 413 : 422).json({
        success: false,
        message: tooLarge ? 'Ukuran maksimum setiap file adalah 10 MB' : 'Format tidak didukung atau jumlah file melebihi batas',
      });
      return;
    }
    next(error);
  });
}

router.use(authenticate);

/* ─── Client onboarding (submit / check-member / poll / search) ─── */

/**
 * POST /check-member — pre-check identitas member ke registry AdBrief
 * (dipakai modal Upload Data Member sebelum submit). Enforcement sebenarnya
 * tetap dijalankan server-side di /onboarding/submit (fail-closed).
 */
router.post(
  '/check-member',
  authorize('SUPER_ADMIN', 'ADMIN', 'ADSCORE'),
  proxyLimiter,
  validateBody(checkMemberRequestSchema),
  postCheckMember,
);

/**
 * POST /member-card-info — proxy profil member (Member Profile dashboard)
 * ke service member-card-info AdBrief (pola P1c). Skala skor upstream:
 * semakin tinggi final_score = semakin tinggi risiko (kategori upstream
 * dikirim verbatim ke client).
 */
router.post(
  '/member-card-info',
  authorize('SUPER_ADMIN', 'ADMIN', 'ADSCORE'),
  proxyLimiter,
  validateBody(memberCardInfoRequestSchema),
  postMemberCardInfo,
);

/**
 * POST /member-card-claims — proxy ringkasan klaim (Claim Summary card)
 * ke service member-card-claims AdBrief (pola P1c). Upstream membalas
 * nol semua untuk member tidak dikenal → dipetakan ke found:false.
 */
router.post(
  '/member-card-claims',
  authorize('SUPER_ADMIN', 'ADMIN', 'ADSCORE'),
  proxyLimiter,
  validateBody(memberCardInfoRequestSchema),
  postMemberCardClaims,
);

/**
 * POST /member-card-monthly — proxy riwayat klaim bulanan (Claim History
 * card) ke service member-card-monthly AdBrief (pola P1c). Upstream membalas
 * nol semua + array kosong untuk member tidak dikenal → dipetakan ke
 * found:false.
 */
router.post(
  '/member-card-monthly',
  authorize('SUPER_ADMIN', 'ADMIN', 'ADSCORE'),
  proxyLimiter,
  validateBody(memberCardInfoRequestSchema),
  postMemberCardMonthly,
);

/**
 * POST /member-card-disease — proxy breakdown biaya klaim per kategori
 * diagnosis (Claim Cost Breakdown card) ke service member-card-disease
 * AdBrief (pola P1c). Upstream data:[] / total nol untuk member tidak
 * dikenal → dipetakan ke found:false.
 */
router.post(
  '/member-card-disease',
  authorize('SUPER_ADMIN', 'ADMIN', 'ADSCORE'),
  proxyLimiter,
  validateBody(memberCardInfoRequestSchema),
  postMemberCardDisease,
);

/**
 * POST /member-card-risk-insights — proxy Top 3 Risk Contributors (Risk
 * Insights card) ke service member-card-rec-dim AdBrief (pola P1c).
 * Upstream data:[] / tanpa baris insight → dipetakan ke found:false.
 */
router.post(
  '/member-card-risk-insights',
  authorize('SUPER_ADMIN', 'ADMIN', 'ADSCORE'),
  proxyLimiter,
  validateBody(memberCardInfoRequestSchema),
  postMemberCardRiskInsights,
);

/**
 * POST /member-card-rec-plan — proxy Next Action card ke service
 * member-card-rec-plan AdBrief (pola P1c). Upstream data:[] → found:false.
 */
router.post(
  '/member-card-rec-plan',
  authorize('SUPER_ADMIN', 'ADMIN', 'ADSCORE'),
  proxyLimiter,
  validateBody(memberCardInfoRequestSchema),
  postMemberCardRecPlan,
);

/**
 * POST /check-member/preview — cek per baris XLSX data member ke AdBrief
 * tanpa membuat job (pre-check UX modal bulk; hasil "X cocok / Y tidak
 * ditemukan" sebelum submit). Enforcement tetap di /onboarding/submit.
 */
router.post(
  '/check-member/preview',
  authorize('SUPER_ADMIN', 'ADMIN', 'ADSCORE'),
  proxyLimiter,
  onboardingUpload,
  postCheckMemberPreview,
);

router.post(
  '/onboarding/submit',
  authorize('SUPER_ADMIN', 'ADMIN', 'ADSCORE'),
  onboardingUpload,
  postOnboardingSubmit,
);

router.get('/onboarding/template', authorize('SUPER_ADMIN', 'ADMIN', 'ADSCORE'), getOnboardingTemplate);
router.get(
  '/onboarding/:jobId/failed-rows-template',
  authorize('SUPER_ADMIN', 'ADMIN', 'ADSCORE', 'ADSCORE_VERIFIER'),
  getOnboardingFailedRowsTemplate,
);
router.get('/onboarding/jobs', authorize('SUPER_ADMIN', 'ADMIN', 'ADSCORE'), getOnboardingJobs);
router.get('/onboarding/search', getMemberSearch);

router.get('/onboarding/:jobId', getOnboardingJobStatus);
router.post('/onboarding/:jobId/cancel', postOnboardingCancel);

/* ─── Verifier console ─── */

const verifierRoles = ['SUPER_ADMIN', 'ADMIN', 'ADSCORE_VERIFIER'] as const;

router.get('/verification/jobs', authorize(...verifierRoles), getVerificationJobs);
router.get('/verification/jobs/:id/consent/:fileId', authorize(...verifierRoles), getVerificationConsentFile);
router.get('/verification/audit', authorize(...verifierRoles), getAudit);
router.post('/verification/jobs/:id/claim', authorize(...verifierRoles), postClaimJob);
router.post('/verification/jobs/:id/unclaim', authorize(...verifierRoles), postUnclaimJob);
router.post('/verification/jobs/:id/cancel', authorize(...verifierRoles), postCancelJob);
router.post('/verification/jobs/:id/consent-check', authorize(...verifierRoles), postConsentCheck);
router.post('/verification/jobs/:id/consent-row', authorize(...verifierRoles), postConsentRow);
router.post('/verification/jobs/:id/match', authorize(...verifierRoles), postMatch);
router.post('/verification/jobs/:id/reject', authorize(...verifierRoles), postReject);
router.post('/verification/jobs/:id/request-fix', authorize(...verifierRoles), postRequestFix);
router.post('/verification/jobs/:id/verify', authorize(...verifierRoles), postVerify);

export default router;