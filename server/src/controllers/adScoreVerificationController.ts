/**
 * AdScore Verification Controller — thin HTTP layer over the model.
 * OpError(status, msg) → HTTP status; everything else → 500.
 */
import type { Response } from 'express';
import ExcelJS from 'exceljs';
import { basename } from 'node:path';
import {
  OpError,
  listJobs,
  claimJob,
  checkConsent,
  setRowConsent,
  resolveMatch,
  rejectJob,
  requestFix,
  verifyJob,
  cancelJob,
  unclaimJob,
  listAudit,
  submitOnboardingJob,
  listOnboardingJobs,
  getOnboardingJob,
  listOnboardingFailedRows,
  searchMembers,
  logCheckMemberAudit,
  type SubmitPayload,
  getConsentFileContent,
  type ConsentFileUpload,
} from '../models/adScoreVerificationModel';
import {
  checkMemberAdBrief,
  checkMemberBatch,
  memberCardClaimsAdBrief,
  memberCardDiseaseAdBrief,
  memberCardInfoAdBrief,
  memberCardMonthlyAdBrief,
  memberCardRecPlanAdBrief,
  memberCardRiskInsightsAdBrief,
  type CheckMemberIdentity,
} from '../utils/adBriefClient';
import type { AuthRequest } from '../middleware/auth';

function actor(req: AuthRequest): string {
  return req.user?.username ?? 'unknown';
}

/** Extract the raw bearer token (forwarded to upstream — pola P1c). */
function bearerToken(req: AuthRequest): string {
  const header = req.headers.authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : header;
}

export function handleError(err: unknown, res: Response): void {
  if (err instanceof OpError) {
    res.status(err.status).json({ success: false, message: err.message });
    return;
  }
  console.error('[adscore] controller error:', err);
  res.status(500).json({ success: false, message: 'Kesalahan server internal' });
}

const MEMBER_HEADERS = [
  'no.',
  'nama lengkap (sesuai ktp)',
  'tanggal lahir (yyyy-mm-dd)',
  'gender (m/f)',
];

function excelDate(value: unknown): string {
  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'number' && Number.isFinite(value)) {
    date = new Date(Date.UTC(1899, 11, 30) + value * 24 * 60 * 60 * 1000);
  } else {
    const text = String(value ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
    const parsed = new Date(`${text}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text ? text : '';
  }
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

async function parseMemberWorkbook(file: Express.Multer.File): Promise<NonNullable<SubmitPayload['rows']>> {
  if (file.buffer.subarray(0, 2).toString() !== 'PK') {
    throw new OpError(422, 'File data member bukan workbook XLSX yang valid');
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(file.buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch {
    throw new OpError(422, 'File data member bukan workbook XLSX yang valid');
  }
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new OpError(422, 'Workbook tidak memiliki sheet data member');

  const headers = MEMBER_HEADERS.map((_, index) => String(worksheet.getRow(1).getCell(index + 1).text).trim().toLowerCase());
  if (headers.some((header, index) => header !== MEMBER_HEADERS[index])) {
    throw new OpError(422, 'Header XLSX tidak sesuai template resmi');
  }

  const rows: NonNullable<SubmitPayload['rows']> = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const nama = row.getCell(2).text.trim();
    const rawDate = row.getCell(3).value;
    const tglLahir = excelDate(rawDate);
    const gender = row.getCell(4).text.trim().toUpperCase();
    if (!nama && !String(rawDate ?? '').trim() && !gender) return;
    if (!nama || !tglLahir || (gender !== 'M' && gender !== 'F')) {
      throw new OpError(422, `Data baris ${rowNumber} tidak valid; periksa nama, tanggal lahir, dan gender M/F`);
    }
    if (rows.length >= 10_000) throw new OpError(422, 'Workbook melebihi batas 10.000 baris');
    rows.push({ nama, tglLahir, gender });
  });
  if (rows.length === 0) throw new OpError(422, 'Workbook tidak berisi data member');
  return rows;
}

/** Baris gagal untuk template perbaikan (dipakai getOnboardingFailedRowsTemplate). */
interface FailedRow {
  rowNo: number;
  nama: string;
  tglLahir: string | null;
  gender: string | null;
  verdict: string;
  note?: string;
}

export async function getOnboardingTemplate(_req: AuthRequest, res: Response): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Data Member');
  worksheet.columns = [
    { header: 'No.', key: 'no', width: 8 },
    { header: 'Nama Lengkap (Sesuai KTP)', key: 'nama', width: 36 },
    { header: 'Tanggal Lahir (YYYY-MM-DD)', key: 'tglLahir', width: 30 },
    { header: 'Gender (M/F)', key: 'gender', width: 18 },
  ];
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="AdScore-Member-Upload-Template.xlsx"');
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(Buffer.from(buffer));
}

/**
 * Template perbaikan berisi HANYA baris yang gagal verifikasi bulk —
 * ter-pra-isi nama/tgl lahir/gender + kolom alasan (temuan verifikator),
 * plus kolom rujukan job asal untuk jejak audit.
 */
export async function getOnboardingFailedRowsTemplate(req: AuthRequest, res: Response): Promise<void> {
  const jobId = String(req.params.jobId ?? '');
  const rows = (await listOnboardingFailedRows(jobId, { username: req.user!.username, role: req.user!.role })) as FailedRow[];
  if (!rows.length) {
    res.status(404).json({ success: false, message: 'Tidak ada baris gagal pada job ini' });
    return;
  }
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Baris Perlu Perbaikan');
  worksheet.columns = [
    { header: 'No.', key: 'no', width: 8 },
    { header: 'Nama Lengkap (Sesuai KTP)', key: 'nama', width: 36 },
    { header: 'Tanggal Lahir (YYYY-MM-DD)', key: 'tglLahir', width: 30 },
    { header: 'Gender (M/F)', key: 'gender', width: 18 },
    { header: 'Alasan Perlu Perbaikan', key: 'reason', width: 60 },
    { header: 'Job Asal', key: 'jobRef', width: 22 },
  ];
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  rows.forEach((r) => {
    worksheet.addRow({
      no: r.rowNo,
      nama: r.nama,
      tglLahir: r.tglLahir ?? '',
      gender: r.gender ?? '',
      reason: r.note ?? '',
      jobRef: jobId,
    });
  });
  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="Perbaikan-${jobId}-baris-gagal.xlsx"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(Buffer.from(buffer));
}

/* ─── Verifier endpoints ─── */

export async function getVerificationJobs(_req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json({ success: true, jobs: await listJobs() });
  } catch (err) {
    handleError(err, res);
  }
}

export async function postClaimJob(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json({ success: true, job: await claimJob(req.params.id, actor(req)) });
  } catch (err) {
    handleError(err, res);
  }
}

export async function postConsentCheck(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { fileId, checked } = req.body ?? {};
    if (!fileId || typeof checked !== 'boolean') {
      res.status(422).json({ success: false, message: 'fileId dan status checked wajib diisi' });
      return;
    }
    res.json({ success: true, job: await checkConsent(req.params.id, fileId, checked, actor(req)) });
  } catch (err) {
    handleError(err, res);
  }
}

export async function postConsentRow(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { rowId, state, fileIds, note } = req.body ?? {};
    if (!rowId || !['unverified', 'match', 'mismatch'].includes(String(state))) {
      res.status(422).json({ success: false, message: 'rowId dan state (unverified/match/mismatch) wajib diisi' });
      return;
    }
    const ids = Array.isArray(fileIds) ? fileIds.filter((id: unknown) => typeof id === 'string') : [];
    res.json({
      success: true,
      job: await setRowConsent(req.params.id, String(rowId), String(state) as 'unverified' | 'match' | 'mismatch', ids, note == null ? undefined : String(note), actor(req)),
    });
  } catch (err) {
    handleError(err, res);
  }
}

export async function postMatch(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { memberId, rowId } = req.body ?? {};
    res.json({ success: true, job: await resolveMatch(req.params.id, memberId ?? null, rowId, actor(req)) });
  } catch (err) {
    handleError(err, res);
  }
}

export async function postReject(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { reason } = req.body ?? {};
    res.json({ success: true, job: await rejectJob(req.params.id, String(reason ?? ''), actor(req)) });
  } catch (err) {
    handleError(err, res);
  }
}

export async function postRequestFix(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { category, note } = req.body ?? {};
    res.json({ success: true, job: await requestFix(req.params.id, String(category ?? 'Lainnya'), String(note ?? ''), actor(req)) });
  } catch (err) {
    handleError(err, res);
  }
}

export async function postVerify(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json({ success: true, job: await verifyJob(req.params.id, actor(req)) });
  } catch (err) {
    handleError(err, res);
  }
}

export async function postUnclaimJob(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json({ success: true, job: await unclaimJob(req.params.id, actor(req)) });
  } catch (err) {
    handleError(err, res);
  }
}

export async function postCancelJob(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { reason } = req.body ?? {};
    res.json({ success: true, job: await cancelJob(req.params.id, actor(req), reason) });
  } catch (err) {
    handleError(err, res);
  }
}

export async function getAudit(req: AuthRequest, res: Response): Promise<void> {
  try {
    const jobId = typeof req.query.jobId === 'string' && req.query.jobId ? req.query.jobId : undefined;
    res.json({ success: true, entries: await listAudit(jobId) });
  } catch (err) {
    handleError(err, res);
  }
}

/* ─── Client onboarding endpoints ─── */

export async function postOnboardingCancel(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { reason } = req.body ?? {};
    const job = await cancelJob(req.params.jobId, actor(req), reason || 'Dibatalkan oleh pemohon');
    res.json({ success: true, job });
  } catch (err) {
    handleError(err, res);
  }
}

export async function postOnboardingSubmit(req: AuthRequest, res: Response): Promise<void> {
  try {
    const form = req.body ?? {};
    if (form.mode !== 'individu' && form.mode !== 'bulk') {
      res.status(422).json({ success: false, message: 'Mode pengajuan tidak valid' });
      return;
    }
    let identity: SubmitPayload['identity'];
    try {
      identity = typeof form.identity === 'string' ? JSON.parse(form.identity) : form.identity;
    } catch {
      res.status(400).json({ success: false, message: 'Format data identitas tidak valid' });
      return;
    }
    const files = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
    const uploadedConsents = files.consentFiles ?? [];
    const dataFile = files.memberFile?.[0];
    const consentFiles: ConsentFileUpload[] = uploadedConsents.map((file) => ({
      name: basename(file.originalname.replace(/\\/g, '/')).slice(0, 255),
      size: file.size,
      type: file.mimetype,
      content: file.buffer,
    }));
    if (consentFiles.some((file) => !hasValidFileSignature(file))) {
      res.status(422).json({ success: false, message: 'Isi file tidak sesuai dengan format PDF, JPG, JPEG, atau PNG' });
      return;
    }
    if (form.mode === 'bulk' && !dataFile) {
      res.status(422).json({ success: false, message: 'File data member (.xlsx) wajib diunggah' });
      return;
    }
    const rows = form.mode === 'bulk' ? await parseMemberWorkbook(dataFile!) : undefined;
    const body: SubmitPayload = {
      mode: form.mode,
      identity,
      dataFileName: dataFile ? basename(dataFile.originalname.replace(/\\/g, '/')).slice(0, 255) : undefined,
      dataFileRows: rows?.length,
      rows,
      consentFiles: consentFiles.map(({ name, size, type }) => ({ name, size, type })),
    };
    const userToken = bearerToken(req);
    if (!userToken) {
      res.status(401).json({ success: false, message: 'Missing authorization token' });
      return;
    }
    res.status(201).json({ success: true, jobId: (await submitOnboardingJob(body, actor(req), consentFiles, userToken)).jobId });
  } catch (err) {
    handleError(err, res);
  }
}

/**
 * POST /api/v1/adscore/check-member — proxy gerbang validasi identitas ke
 * service check-member AdBrief (pola P1c). Dipakai modal Upload Data Member
 * untuk pre-check UX; enforcement sebenarnya terjadi di submitOnboardingJob.
 *
 * Respons (kontrak upstream terverifikasi):
 *   found    → { success:true, found:true,  message:'Success' }
 *   notfound → { success:true, found:false, message:'Data Member Tidak Ada' }
 *   failure  → 503/504/502 { success:false, message:sanitized }
 */
export async function postCheckMember(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userToken = bearerToken(req);
    if (!userToken) {
      res.status(401).json({ success: false, message: 'Missing authorization token' });
      return;
    }
    const { member_name, dob, gender } = req.body as CheckMemberIdentity;
    const context = (req.body as { context?: string } | undefined)?.context;
    const identity: CheckMemberIdentity = { member_name, dob, gender };
    const result = await checkMemberAdBrief(identity, userToken);
    if (!result.ok) {
      res.status(result.status).json({ success: false, message: result.message });
      return;
    }
    // Fase 5: aksi check-member eksplisit (Cari Data Member) dicatat audit;
    // pre-check UX modal upload tidak (hindari spam audit).
    if (context === 'member-search') {
      await logCheckMemberAudit(actor(req), identity, result.found);
    }
    res.json({ success: true, found: result.found, message: result.message });
  } catch (err) {
    handleError(err, res);
  }
}

/**
 * POST /api/v1/adscore/member-card-info — proxy profil member (Member
 * Profile dashboard) ke service member-card-info AdBrief (pola P1c).
 *
 * Respons (kontrak upstream terverifikasi):
 *   found    → { success:true, found:true,  member:{...} }
 *   notfound → { success:true, found:false }            (data:[] — valid)
 *   failure  → 503/504/502 { success:false, message:sanitized }
 */
export async function postMemberCardInfo(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userToken = bearerToken(req);
    if (!userToken) {
      res.status(401).json({ success: false, message: 'Missing authorization token' });
      return;
    }
    const { member_name, dob, gender } = req.body as CheckMemberIdentity;
    const result = await memberCardInfoAdBrief({ member_name, dob, gender }, userToken);
    if (!result.ok) {
      res.status(result.status).json({ success: false, message: result.message });
      return;
    }
    res.json({ success: true, found: result.member !== null, ...(result.member ? { member: result.member } : {}) });
  } catch (err) {
    handleError(err, res);
  }
}

/**
 * POST /api/v1/adscore/member-card-claims — proxy ringkasan klaim (Claim
 * Summary card) ke service member-card-claims AdBrief (pola P1c).
 *
 * Respons:
 *   found    → { success:true, found:true,  claims:{ total_claims, avg_claim_cost } }
 *   notfound → { success:true, found:false }   (upstream nol semua / data null —
 *              tanpa data klaim, BUKAN angka riil 0)
 *   failure  → 503/504/502 { success:false, message:sanitized }
 */
export async function postMemberCardClaims(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userToken = bearerToken(req);
    if (!userToken) {
      res.status(401).json({ success: false, message: 'Missing authorization token' });
      return;
    }
    const { member_name, dob, gender } = req.body as CheckMemberIdentity;
    const result = await memberCardClaimsAdBrief({ member_name, dob, gender }, userToken);
    if (!result.ok) {
      res.status(result.status).json({ success: false, message: result.message });
      return;
    }
    res.json({ success: true, found: result.claims !== null, ...(result.claims ? { claims: result.claims } : {}) });
  } catch (err) {
    handleError(err, res);
  }
}

/**
 * POST /api/v1/adscore/member-card-monthly — proxy riwayat klaim bulanan
 * (Claim History card) ke service member-card-monthly AdBrief (pola P1c).
 *
 * Respons:
 *   found    → { success:true, found:true,  monthly:{ total_claim_amount,
 *              total_claims, data:[{ month, claim_amount, number_of_claims }] } }
 *   notfound → { success:true, found:false }   (upstream nol semua + array
 *              kosong — tanpa riwayat klaim, BUKAN angka riil 0)
 *   failure  → 503/504/502 { success:false, message:sanitized }
 */
export async function postMemberCardMonthly(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userToken = bearerToken(req);
    if (!userToken) {
      res.status(401).json({ success: false, message: 'Missing authorization token' });
      return;
    }
    const { member_name, dob, gender } = req.body as CheckMemberIdentity;
    const result = await memberCardMonthlyAdBrief({ member_name, dob, gender }, userToken);
    if (!result.ok) {
      res.status(result.status).json({ success: false, message: result.message });
      return;
    }
    res.json({ success: true, found: result.monthly !== null, ...(result.monthly ? { monthly: result.monthly } : {}) });
  } catch (err) {
    handleError(err, res);
  }
}

/**
 * POST /api/v1/adscore/member-card-disease — proxy breakdown biaya klaim per
 * kategori diagnosis (Claim Cost Breakdown card) ke service
 * member-card-disease AdBrief (pola P1c).
 *
 * Respons:
 *   found    → { success:true, found:true,  disease:{ type:'pie', total_bill,
 *              data:[{ name, value, value_formatted, persentage }] } }
 *   notfound → { success:true, found:false }   (upstream pie kosong
 *              { total_bill:0, data:[] } — tanpa breakdown, BUKAN angka riil 0)
 *   failure  → 503/504/502 { success:false, message:sanitized }
 */
export async function postMemberCardDisease(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userToken = bearerToken(req);
    if (!userToken) {
      res.status(401).json({ success: false, message: 'Missing authorization token' });
      return;
    }
    const { member_name, dob, gender } = req.body as CheckMemberIdentity;
    const result = await memberCardDiseaseAdBrief({ member_name, dob, gender }, userToken);
    if (!result.ok) {
      res.status(result.status).json({ success: false, message: result.message });
      return;
    }
    res.json({ success: true, found: result.disease !== null, ...(result.disease ? { disease: result.disease } : {}) });
  } catch (err) {
    handleError(err, res);
  }
}

/**
 * POST /api/v1/adscore/member-card-risk-insights — proxy Top 3 Risk
 * Contributors (Risk Insights card) ke service member-card-rec-dim AdBrief
 * (pola P1c).
 *
 * Respons:
 *   found    → { success:true, found:true,  insights:[{ dimension_rank,
 *              next_action_dimension, title_web }] } (diurutkan per rank)
 *   notfound → { success:true, found:false }   (upstream data:[] / tanpa baris
 *              insight — respons valid, bukan error)
 *   failure  → 503/504/502 { success:false, message:sanitized }
 */
export async function postMemberCardRiskInsights(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userToken = bearerToken(req);
    if (!userToken) {
      res.status(401).json({ success: false, message: 'Missing authorization token' });
      return;
    }
    const { member_name, dob, gender } = req.body as CheckMemberIdentity;
    const result = await memberCardRiskInsightsAdBrief({ member_name, dob, gender }, userToken);
    if (!result.ok) {
      res.status(result.status).json({ success: false, message: result.message });
      return;
    }
    const insights = [...result.insights].sort((a, b) => a.dimension_rank - b.dimension_rank);
    res.json({ success: true, found: insights.length > 0, ...(insights.length > 0 ? { insights } : {}) });
  } catch (err) {
    handleError(err, res);
  }
}

/**
 * POST /api/v1/adscore/member-card-rec-plan — proxy Next Action card ke
 * service member-card-rec-plan AdBrief (pola P1c).
 *
 * Respons:
 *   found    → { success:true, found:true, plans:[{ category_adscore,
 *              next_action }] }
 *   notfound → { success:true, found:false }   (upstream data:[] — respons
 *              valid, bukan error)
 *   failure  → 503/504/502 { success:false, message:sanitized }
 */
export async function postMemberCardRecPlan(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userToken = bearerToken(req);
    if (!userToken) {
      res.status(401).json({ success: false, message: 'Missing authorization token' });
      return;
    }
    const { member_name, dob, gender } = req.body as CheckMemberIdentity;
    const result = await memberCardRecPlanAdBrief({ member_name, dob, gender }, userToken);
    if (!result.ok) {
      res.status(result.status).json({ success: false, message: result.message });
      return;
    }
    res.json({ success: true, found: result.plans.length > 0, ...(result.plans.length > 0 ? { plans: result.plans } : {}) });
  } catch (err) {
    handleError(err, res);
  }
}

/**
 * POST /api/v1/adscore/check-member/preview — cek per baris file XLSX data
 * member ke service check-member AdBrief TANPA membuat job (pre-check UX
 * modal bulk, sesuai plan Fase 5: "X cocok / Y tidak ditemukan" sebelum
 * submit). Enforcement sebenarnya tetap dijalankan server-side saat submit.
 * Dibatasi 1.000 baris per preview.
 */
export async function postCheckMemberPreview(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userToken = bearerToken(req);
    if (!userToken) {
      res.status(401).json({ success: false, message: 'Missing authorization token' });
      return;
    }
    const files = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
    const dataFile = files.memberFile?.[0];
    if (!dataFile) {
      res.status(422).json({ success: false, message: 'File data member (.xlsx) wajib diunggah' });
      return;
    }
    const rows = await parseMemberWorkbook(dataFile);
    if (rows.length > 1_000) {
      throw new OpError(422, 'Preview dibatasi 1.000 baris; pecah file untuk pengajuan lebih besar');
    }
    const results = await checkMemberBatch(
      rows.map((row) => ({ member_name: row.nama, dob: row.tglLahir, gender: row.gender as 'M' | 'F' })),
      userToken,
    );
    const failed = results.findIndex((row) => row.error !== undefined);
    if (failed >= 0) {
      const row = results[failed]!;
      res.status(row.error ?? 502).json({ success: false, message: `Baris ${failed + 1} (${rows[failed]?.nama}): ${row.message}` });
      return;
    }
    const found = results.filter((row) => row.found).length;
    res.json({
      success: true,
      total: rows.length,
      found,
      notFound: rows.length - found,
      rows: rows.map((row, index) => ({ nama: row.nama, tglLahir: row.tglLahir, gender: row.gender, found: results[index]?.found === true })),
    });
  } catch (err) {
    handleError(err, res);
  }
}

function hasValidFileSignature(file: ConsentFileUpload): boolean {
  if (file.type === 'application/pdf') return file.content.subarray(0, 5).toString() === '%PDF-';
  if (file.type === 'image/jpeg') return file.content[0] === 0xff && file.content[1] === 0xd8 && file.content[2] === 0xff;
  if (file.type === 'image/png') return file.content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return false;
}

export async function getVerificationConsentFile(req: AuthRequest, res: Response): Promise<void> {
  try {
    const file = await getConsentFileContent(req.params.id, req.params.fileId);
    res.setHeader('Content-Type', file.type);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file.content);
  } catch (err) {
    handleError(err, res);
  }
}

export async function getOnboardingJobStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    const requester = { username: actor(req), role: req.user?.role ?? '' };
    const result = await getOnboardingJob(req.params.jobId, requester);
    if (!result) {
      res.status(404).json({ success: false, message: 'Job tidak ditemukan' });
      return;
    }
    res.json({ success: true, ...result });
  } catch (err) {
    handleError(err, res);
  }
}

export async function getOnboardingJobs(req: AuthRequest, res: Response): Promise<void> {
  try {
    const username = req.user?.username;
    if (!username) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }
    res.json({ success: true, jobs: await listOnboardingJobs(username) });
  } catch (err) {
    handleError(err, res);
  }
}

export async function getMemberSearch(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { nama, tglLahir, gender } = req.query as Record<string, string | undefined>;
    res.json({ success: true, ...(await searchMembers({ nama, tglLahir, gender })) });
  } catch (err) {
    handleError(err, res);
  }
}

