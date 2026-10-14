/**
 * AdScore Verification Model — DB-backed job pipeline for the
 * "AdMedika Member Risk Scoring" flow.
 *
 * Two consumers:
 *  - CLIENT (role ADSCORE): submits onboarding jobs (individu / bulk excel),
 *    polls job status, searches the member registry.
 *  - VERIFIER (role ADSCORE_VERIFIER): claims jobs, reviews consent files,
 *    resolves fuzzy matches, verifies / rejects / requests fix.
 *
 * Tables (created IF NOT EXISTS, seeded on first use):
 *  - ad_score_members               → membership registry (matching source)
 *  - ad_score_verification_jobs     → one row per submitted job
 *  - ad_score_verification_rows     → bulk rows + resolution state
 *  - ad_score_consent_files         → consent documents metadata + review state
 *  - ad_score_verification_audit    → audit trail (who / when / what / outcome)
 *
 * NOTE: consent files are stored as METADATA only in this phase. Real file
 * upload (multipart → object storage) is a documented next step; the API
 * contract already carries { name, size, type } per file.
 */
import { randomBytes } from 'crypto';
import { pool } from './db';
import { checkMemberAdBrief, checkMemberBatch, type CheckMemberIdentity } from '../utils/adBriefClient';

/* ─── Types (mirror of frontend adscore-verifier/model/verifierTypes.ts) ─── */

export type JobStatus = 'submitted' | 'on_progress' | 'verified' | 'completed' | 'cancelled';
export type JobMode = 'individu' | 'bulk';
export type RowState = 'auto' | 'manual' | 'notfound' | 'unresolved';
/** Keputusan verifikasi dokumen persetujuan per baris bulk (strict). */
export type RowConsentState = 'unverified' | 'match' | 'mismatch';

export interface MatchCandidate {
  memberId: string;
  nama: string;
  tglLahir: string;
  gender: string;
  score: number;
  exact: boolean;
  registeredAt: number;
}

export interface VerifierJobDTO {
  id: string;
  mode: JobMode;
  status: JobStatus;
  createdAt: number;
  submittedBy: string;
  identity?: { nama: string; tglLahir: string; gender: string };
  dataFile?: { name: string; rows: number };
  consentFiles: Array<{ id: string; name: string; size: number; type: string; uploadedAt: number }>;
  consentChecked: string[];
  claimedBy?: string;
  claimedAt?: number;
  candidates?: MatchCandidate[];
  pickedMemberId?: string;
  /** AdBrief check-member result recorded at submission (new-flow individu jobs). */
  adbriefFound?: boolean;
  adbriefCheckedAt?: number;
  rows?: Array<{
    rowId: string;
    rowNo: number;
    nama: string;
    tglLahir: string;
    gender: string;
    state: RowState;
    memberId?: string;
    candidates: MatchCandidate[];
    /** Verifikasi dokumen persetujuan per member (bulk, strict). */
    consent?: {
      state: RowConsentState;
      fileIds: string[];
      checkedAt?: number;
      checkedBy?: string;
      note?: string;
    };
  }>;
  rejectionReason?: string;
  fixCategory?: string;
  fixNote?: string;
  outcome?: string;
}

export interface AuditEntryDTO {
  id: string;
  jobId: string;
  at: number;
  action: string;
  actor: string;
  detail: string;
  outcome: string;
}

export interface MemberDTO {
  memberId: string;
  nama: string;
  tglLahir: string;
  gender: string;
  registeredAt: number;
  source: string;
}

/* ─── Schema & seed ─── */

const REGISTRY_SEED: Array<[string, string, string, string]> = [
  // [memberId, nama, tglLahir, gender]
  ['ADM-00142', 'Budi Santoso', '1980-05-14', 'M'],
  ['ADM-00177', 'Siti Nurhaliza', '1985-11-02', 'F'],
  ['ADM-00201', 'Agus Wijaya', '1979-03-21', 'M'],
  ['ADM-00233', 'Dewi Lestari', '1990-07-30', 'F'],
  ['ADM-00256', 'Rudi Hartono', '1975-01-17', 'M'],
  ['ADM-00261', 'Maya Sari', '1988-09-08', 'F'],
  ['ADM-00288', 'Andi Pratama', '1992-12-25', 'M'],
  // Same name as ADM-00142 but different DOB → exercises fuzzy matching
  ['ADM-00318', 'Budi Santosa', '1975-05-14', 'M'],
  ['ADM-00340', 'Rina Marlina', '1983-04-11', 'F'],
  ['ADM-00355', 'Fitri Handayani', '1995-08-19', 'F'],
];

/** Simulated content of the uploaded Excel template (10 numbered rows).
 *  7 exact matches, 2 realistic typos (fuzzy → manual review), 1 unknown. */
const BULK_DEMO_ROWS: Array<[string, string, string]> = [
  ['Budi Santoso', '1980-05-14', 'M'],
  ['Siti Nurhaliza', '1985-11-02', 'F'],
  ['Agus Wijaya', '1979-03-21', 'M'],
  ['Dewi Lestari', '1990-07-30', 'F'],
  ['Rudi Hartono', '1975-01-17', 'M'],
  ['Maya Sari', '1988-09-08', 'F'],
  ['Andi Pratama', '1992-12-25', 'M'],
  ['Budi Santosa', '1980-05-14', 'M'],
  ['Dewi Lestarii', '1990-07-30', 'F'],
  ['Joko Susilo', '1972-06-05', 'M'],
];

const MIN = 60_000;
const BLOB_CHUNK_SIZE = 256 * 1024;

let schemaReady: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ad_score_members (
          member_id      VARCHAR(20)  PRIMARY KEY,
          nama           VARCHAR(150) NOT NULL,
          tgl_lahir      DATE         NOT NULL,
          gender         CHAR(1)      NOT NULL,
          registered_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
          source         VARCHAR(50)  NOT NULL DEFAULT 'seed',
          INDEX idx_asm_nama (nama),
          INDEX idx_asm_dob (tgl_lahir)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ad_score_verification_jobs (
          id               VARCHAR(40)  PRIMARY KEY,
          mode             ENUM('individu','bulk') NOT NULL,
          status           ENUM('submitted','on_progress','verified','completed','cancelled') NOT NULL DEFAULT 'submitted',
          submitted_by     VARCHAR(100) NOT NULL,
          identity_nama    VARCHAR(150) NULL,
          identity_tgl     DATE         NULL,
          identity_gender  CHAR(1)      NULL,
          data_file_name   VARCHAR(255) NULL,
          data_file_rows   INT          NULL,
          claimed_by       VARCHAR(100) NULL,
          claimed_at       TIMESTAMP    NULL,
          picked_member_id VARCHAR(20)  NULL,
          rejection_reason TEXT         NULL,
          fix_category     VARCHAR(60)  NULL,
          fix_note         TEXT         NULL,
          outcome          VARCHAR(255) NULL,
          created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_asv_status (status),
          INDEX idx_asv_created (created_at),
          INDEX idx_asv_owner_status_created (submitted_by, status, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      const [jobStatusCol]: any = await pool.query(
        `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ad_score_verification_jobs' AND COLUMN_NAME = 'status'`,
      );
      if (jobStatusCol.length > 0 && !String(jobStatusCol[0].COLUMN_TYPE).includes('cancelled')) {
        await pool.query(
          "ALTER TABLE ad_score_verification_jobs MODIFY COLUMN status ENUM('submitted','on_progress','verified','completed','cancelled') NOT NULL DEFAULT 'submitted'",
        );
      }
      const [ownerIndex]: any = await pool.query(
        `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ad_score_verification_jobs'
           AND INDEX_NAME = 'idx_asv_owner_status_created'`,
      );
      if (ownerIndex.length === 0) {
        await pool.query(
          'CREATE INDEX idx_asv_owner_status_created ON ad_score_verification_jobs (submitted_by, status, created_at)',
        );
      }
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ad_score_verification_rows (
          row_id    VARCHAR(40)  PRIMARY KEY,
          job_id    VARCHAR(40)  NOT NULL,
          row_no    INT          NOT NULL,
          nama      VARCHAR(150) NOT NULL,
          tgl_lahir DATE         NULL,
          gender    CHAR(1)      NULL,
          state     ENUM('auto','manual','notfound','unresolved') NOT NULL DEFAULT 'unresolved',
          member_id VARCHAR(20)  NULL,
          consent_state      ENUM('unverified','match','mismatch') NULL,
          consent_checked_by VARCHAR(100) NULL,
          consent_checked_at DATETIME NULL,
          consent_note       VARCHAR(500) NULL,
          consent_file_ids   VARCHAR(500) NULL,
          INDEX idx_asvr_job (job_id),
          CONSTRAINT fk_asvr_job FOREIGN KEY (job_id)
            REFERENCES ad_score_verification_jobs(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      // Kolom verifikasi consent per member (bulk, strict) — self-healing
      // untuk tabel yang sudah ada sebelum kolom ini tersedia.
      const [rowConsentColumns]: any = await pool.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ad_score_verification_rows' AND COLUMN_NAME = 'consent_state'`,
      );
      if (rowConsentColumns.length === 0) {
        await pool.query(
          `ALTER TABLE ad_score_verification_rows
           ADD COLUMN consent_state ENUM('unverified','match','mismatch') NULL,
           ADD COLUMN consent_checked_by VARCHAR(100) NULL,
           ADD COLUMN consent_checked_at DATETIME NULL,
           ADD COLUMN consent_note VARCHAR(500) NULL,
           ADD COLUMN consent_file_ids VARCHAR(500) NULL`,
        );
      }
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ad_score_consent_files (
          id          VARCHAR(40)  PRIMARY KEY,
          job_id      VARCHAR(40)  NOT NULL,
          name        VARCHAR(255) NOT NULL,
          size        INT          NOT NULL,
          type        VARCHAR(120) NOT NULL DEFAULT 'application/octet-stream',
          content     LONGBLOB     NULL,
          uploaded_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
          checked_by  VARCHAR(100) NULL,
          checked_at  TIMESTAMP    NULL,
          INDEX idx_ascf_job (job_id),
          CONSTRAINT fk_ascf_job FOREIGN KEY (job_id)
            REFERENCES ad_score_verification_jobs(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      const [consentColumns]: any = await pool.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ad_score_consent_files' AND COLUMN_NAME = 'content'`,
      );
      if (consentColumns.length === 0) {
        await pool.query('ALTER TABLE ad_score_consent_files ADD COLUMN content LONGBLOB NULL');
      }
      // AdBrief check-member evidence columns (Fase 0/1) — self-healing untuk
      // tabel yang sudah ada sebelum kolom ini tersedia.
      const [adbriefColumns]: any = await pool.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ad_score_verification_jobs' AND COLUMN_NAME = 'adbrief_found'`,
      );
      if (adbriefColumns.length === 0) {
        await pool.query(
          'ALTER TABLE ad_score_verification_jobs ADD COLUMN adbrief_found TINYINT(1) NULL, ADD COLUMN adbrief_checked_at DATETIME NULL',
        );
      }
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ad_score_consent_file_chunks (
          file_id   VARCHAR(40) NOT NULL,
          chunk_no  INT         NOT NULL,
          content   MEDIUMBLOB  NOT NULL,
          PRIMARY KEY (file_id, chunk_no),
          CONSTRAINT fk_ascfc_file FOREIGN KEY (file_id)
            REFERENCES ad_score_consent_files(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ad_score_verification_audit (
          id         BIGINT AUTO_INCREMENT PRIMARY KEY,
          job_id     VARCHAR(40)  NULL,
          action     VARCHAR(40)  NOT NULL,
          actor      VARCHAR(100) NOT NULL,
          detail     VARCHAR(500) NOT NULL,
          outcome    VARCHAR(255) NOT NULL,
          created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_asva_job (job_id),
          INDEX idx_asva_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      if (process.env.ADSCORE_SEED_DEMO === 'true') {
        await seedRegistryIfEmpty();
        await seedDemoJobsIfEmpty();
      }
    })();
  }
  return schemaReady;
}

async function seedRegistryIfEmpty(): Promise<void> {
  const [rows]: any = await pool.query('SELECT COUNT(*) AS n FROM ad_score_members');
  if (Number(rows[0].n) > 0) return;
  for (const [memberId, nama, tglLahir, gender] of REGISTRY_SEED) {
    await pool.query(
      'INSERT IGNORE INTO ad_score_members (member_id, nama, tgl_lahir, gender, source) VALUES (?, ?, ?, ?, ?)',
      [memberId, nama, tglLahir, gender, 'seed'],
    );
  }
  console.log(`[adscore] seeded ${REGISTRY_SEED.length} registry members`);
}

async function seedDemoJobsIfEmpty(): Promise<void> {
  const [rows]: any = await pool.query('SELECT COUNT(*) AS n FROM ad_score_verification_jobs');
  if (Number(rows[0].n) > 0) return;

  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');

  interface SeedJob {
    id: string;
    mode: JobMode;
    status: JobStatus;
    createdAt: number;
    submittedBy: string;
    identity?: [string, string, string];
    dataFile?: [string, number];
    consent: Array<[string, string, number]>;
    consentChecked?: string[];
    claimedBy?: string;
    claimedAt?: number;
    pickedMemberId?: string;
    outcome?: string;
    rejectionReason?: string;
    fixCategory?: string;
    fixNote?: string;
    rows?: Array<[string, string, string, string, RowState, string | undefined]>;
  }

  const seeds: SeedJob[] = [
    {
      id: 'JOB-2025-0193', mode: 'individu', status: 'submitted',
      createdAt: now - 12 * MIN, submittedBy: 'client.nahsehat',
      identity: ['Siti Nurhaliza X', '1985-11-02', 'F'],
      consent: [['CF-0193A1', 'consent_siti.pdf', 412_000]],
    },
    {
      id: 'JOB-2025-0192', mode: 'bulk', status: 'submitted',
      createdAt: now - 65 * MIN, submittedBy: 'client.nahsehat',
      dataFile: ['data_member_batch3.xlsx', 10],
      consent: [
        ['CF-0192B1', 'consent_batch3.pdf', 820_000],
        ['CF-0192B2', 'surat_tugas_batch3.pdf', 310_000],
      ],
      rows: BULK_DEMO_ROWS.map((r, i) => {
        const [c] = findCandidates(r[0], r[1], r[2], REGISTRY_SEED.map(
          ([memberId, nama, tglLahir, gender]) => ({ memberId, nama, tglLahir, gender, registeredAt: now, source: 'seed' }),
        ));
        const state: RowState = c?.exact ? 'auto' : c ? 'unresolved' : 'notfound';
        return [`JOB-2025-0192-r${i + 1}`, r[0], r[1], r[2], state, c?.exact ? c.memberId : undefined];
      }),
    },
    {
      id: 'JOB-2025-0187', mode: 'individu', status: 'on_progress',
      createdAt: now - 160 * MIN, submittedBy: 'client.nahsehat',
      identity: ['Budi Santoso', '1980-05-14', 'M'],
      consent: [
        ['CF-0187A1', 'consent_budi_santoso.pdf', 412_000],
        ['CF-0187A2', 'ktp_budi_santoso.jpg', 1_200_000],
        ['CF-0187A3', 'surat_pernyataan_setuju.png', 640_000],
      ],
      claimedBy: 'verifier.ops', claimedAt: now - 90 * MIN,
    },
    {
      id: 'JOB-2025-0185', mode: 'bulk', status: 'on_progress',
      createdAt: now - 310 * MIN, submittedBy: 'client.mediplus',
      dataFile: ['member_dump.xlsx', 24],
      consent: [['CF-0185C1', 'consent_mediplus.pdf', 950_000]],
      claimedBy: 'verifier.b', claimedAt: now - 120 * MIN,
    },
    {
      id: 'JOB-2025-0181', mode: 'individu', status: 'verified',
      createdAt: now - 180 * MIN, submittedBy: 'client.nahsehat',
      identity: ['Agus Wijaya', '1979-03-21', 'M'],
      consent: [['CF-0181D1', 'consent_agus.jpg', 700_000]],
      fixCategory: 'Consent', fixNote: 'Consent tidak terbaca — mohon unggah ulang dokumen consent',
      outcome: 'Request Fix — Consent',
    },
    {
      id: 'JOB-2025-0179', mode: 'bulk', status: 'verified',
      createdAt: now - 380 * MIN, submittedBy: 'client.mediplus',
      dataFile: ['bulk_juli.xlsx', 10],
      consent: [
        ['CF-0179E1', 'consent_juli.pdf', 500_000],
        ['CF-0179E2', 'surat_juli.pdf', 220_000],
      ],
      consentChecked: ['CF-0179E1', 'CF-0179E2'],
      rows: BULK_DEMO_ROWS.map((r, i) => {
        const rowId = `JOB-2025-0179-r${i + 1}`;
        if (r[0] === 'Budi Santosa') return [rowId, r[0], r[1], r[2], 'manual', 'ADM-00142'] as const;
        if (r[0] === 'Dewi Lestarii') return [rowId, r[0], r[1], r[2], 'manual', 'ADM-00233'] as const;
        const [c] = findCandidates(r[0], r[1], r[2], REGISTRY_SEED.map(
          ([memberId, nama, tglLahir, gender]) => ({ memberId, nama, tglLahir, gender, registeredAt: now, source: 'seed' }),
        ));
        return [rowId, r[0], r[1], r[2], c?.exact ? 'auto' : 'notfound', c?.exact ? c.memberId : undefined] as const;
      }),
      outcome: 'Bulk Confirmation — 9 cocok, 1 tidak ditemukan',
    },
    {
      id: 'JOB-2025-0176', mode: 'individu', status: 'completed',
      createdAt: now - 8 * 60 * MIN, submittedBy: 'client.nahsehat',
      identity: ['Dewi Lestari', '1990-07-30', 'F'],
      consent: [
        ['CF-0176F1', 'surat_pernyataan_dewi.png', 640_000],
        ['CF-0176F2', 'ktp_dewi.jpg', 1_100_000],
      ],
      consentChecked: ['CF-0176F1', 'CF-0176F2'],
      claimedBy: 'verifier.ops', claimedAt: now - 7 * 60 * MIN,
      pickedMemberId: 'ADM-00233',
      outcome: 'Verified → Success (ADM-00233)',
    },
    {
      id: 'JOB-2025-0175', mode: 'individu', status: 'cancelled',
      createdAt: now - 35 * MIN, submittedBy: 'client.member-portal',
      identity: ['Rina Marlina', '1993-04-12', 'F'],
      consent: [['CF-0175R1', 'consent_rina_marlina.pdf', 380_000]],
      outcome: 'Dibatalkan oleh pemohon',
    },
  ];

  for (const s of seeds) {
    const identity = s.identity ?? [null, null, null];
    const dataFile = s.dataFile ?? [null, null];
    await pool.query(
      `INSERT INTO ad_score_verification_jobs
        (id, mode, status, submitted_by, identity_nama, identity_tgl, identity_gender,
         data_file_name, data_file_rows, claimed_by, claimed_at, picked_member_id,
         rejection_reason, fix_category, fix_note, outcome, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        s.id, s.mode, s.status, s.submittedBy, identity[0], identity[1], identity[2],
        dataFile[0], dataFile[1], s.claimedBy ?? null,
        s.claimedAt ? iso(s.claimedAt) : null, s.pickedMemberId ?? null,
        s.rejectionReason ?? null, s.fixCategory ?? null, s.fixNote ?? null, s.outcome ?? null,
        iso(s.createdAt), iso(s.createdAt),
      ],
    );
    for (const [id, name, size] of s.consent) {
      await pool.query(
        `INSERT INTO ad_score_consent_files (id, job_id, name, size, type, uploaded_at, checked_by, checked_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, s.id, name, size, name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
          iso(s.createdAt), s.consentChecked?.includes(id) ? s.claimedBy ?? 'verifier.ops' : null,
          s.consentChecked?.includes(id) ? iso(s.createdAt) : null,
        ],
      );
    }
    if (s.rows) {
      for (let i = 0; i < s.rows.length; i++) {
        const [rowId, nama, tglLahir, gender, state, memberId] = s.rows[i];
        await pool.query(
          `INSERT INTO ad_score_verification_rows (row_id, job_id, row_no, nama, tgl_lahir, gender, state, member_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [rowId, s.id, i + 1, nama, tglLahir, gender, state, memberId ?? null],
        );
      }
    }
  }
  console.log(`[adscore] seeded ${seeds.length} demo verification jobs`);
}

/* ─── Matching engine ─── */

function normalizeNama(nama: string): string {
  return nama.trim().toLowerCase().replace(/\s+/g, ' ');
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

function nameSimilarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  return max === 0 ? 1 : 1 - levenshtein(a, b) / max;
}

interface RegistryRow { memberId: string; nama: string; tglLahir: string; gender: string; registeredAt: number; source: string }

/** Score candidates for a submitted identity. Deterministic, top-5, ≥60. */
export function findCandidates(
  nama: string,
  tglLahir: string | null,
  gender: string | null,
  registry: RegistryRow[],
): MatchCandidate[] {
  const nN = normalizeNama(nama);
  if (!nN) return [];
  const scored = registry.map((m) => {
    const mN = normalizeNama(m.nama);
    const nameEq = mN === nN;
    const dobEq = !!tglLahir && m.tglLahir === tglLahir;
    const gEq = !!gender && m.gender === gender;
    let score: number;
    let exact = false;
    if (nameEq && (!tglLahir || dobEq) && (!gender || gEq)) {
      score = 100;
      exact = true;
    } else if (nameEq) {
      // Same name, conflicting DOB/gender → suspicious, manual review
      score = 90;
    } else {
      score = Math.round(nameSimilarity(nN, mN) * 100);
      if (dobEq && gEq) score = Math.min(98, score + 6);
      else if (dobEq || gEq) score = Math.min(97, score + 2);
    }
    return { m, score, exact };
  });
  return scored
    .filter((s) => s.score >= 60)
    .sort((a, b) => b.score - a.score || b.m.registeredAt - a.m.registeredAt)
    .slice(0, 5)
    .map(({ m, score, exact }) => ({
      memberId: m.memberId,
      nama: m.nama,
      tglLahir: m.tglLahir,
      gender: m.gender,
      score,
      exact,
      registeredAt: m.registeredAt,
    }));
}

async function loadRegistry(): Promise<RegistryRow[]> {
  const [rows]: any = await pool.query(`
    SELECT member_id, nama, DATE_FORMAT(tgl_lahir, '%Y-%m-%d') AS tgl_lahir, gender,
           registered_at, source
    FROM ad_score_members
  `);
  return rows.map((r: any) => ({
    memberId: r.member_id,
    nama: r.nama,
    tglLahir: r.tgl_lahir,
    gender: r.gender,
    registeredAt: new Date(r.registered_at).getTime(),
    source: r.source,
  }));
}

/* ─── Job DTO mapping ─── */

type JobRowAny = any;

function ts(v: any): number | undefined {
  return v ? new Date(v).getTime() : undefined;
}

export async function listJobs(): Promise<VerifierJobDTO[]> {
  await ensureSchema();
  const [jobs]: any = await pool.query(`
    SELECT *, DATE_FORMAT(identity_tgl, '%Y-%m-%d') AS identity_tgl_iso
    FROM ad_score_verification_jobs ORDER BY created_at DESC
  `);
  const [consents]: any = await pool.query('SELECT * FROM ad_score_consent_files ORDER BY uploaded_at ASC');
  const [rows]: any = await pool.query(`
    SELECT *, DATE_FORMAT(tgl_lahir, '%Y-%m-%d') AS tgl_iso
    FROM ad_score_verification_rows ORDER BY row_no ASC
  `);
  const registry = await loadRegistry();

  const consentByJob = new Map<string, any[]>();
  for (const c of consents) {
    const list = consentByJob.get(c.job_id) ?? [];
    list.push(c);
    consentByJob.set(c.job_id, list);
  }
  const rowsByJob = new Map<string, any[]>();
  for (const r of rows) {
    const list = rowsByJob.get(r.job_id) ?? [];
    list.push(r);
    rowsByJob.set(r.job_id, list);
  }

  return (jobs as JobRowAny[]).map((j) => {
    const approved = j.status === 'verified' && (
      (j.mode === 'individu' && !!j.picked_member_id) ||
      (j.mode === 'bulk' && String(j.outcome ?? '').startsWith('Bulk Confirmation'))
    );
    const jobConsents = (consentByJob.get(j.id) ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      size: c.size,
      type: c.type,
      uploadedAt: ts(c.uploaded_at)!,
    }));
    const dto: VerifierJobDTO = {
      id: j.id,
      mode: j.mode,
      status: approved ? 'completed' : j.status,
      createdAt: ts(j.created_at)!,
      submittedBy: j.submitted_by,
      consentFiles: jobConsents,
      consentChecked: (consentByJob.get(j.id) ?? []).filter((c: any) => c.checked_by != null).map((c: any) => c.id),
    };
    if (j.identity_nama) {
      dto.identity = { nama: j.identity_nama, tglLahir: j.identity_tgl_iso ?? '', gender: j.identity_gender ?? '' };
    }
    if (j.data_file_name) {
      dto.dataFile = { name: j.data_file_name, rows: j.data_file_rows ?? 0 };
    }
    if (j.claimed_by) {
      dto.claimedBy = j.claimed_by;
      dto.claimedAt = ts(j.claimed_at);
    }
    if (j.picked_member_id) dto.pickedMemberId = j.picked_member_id;
    if (j.adbrief_found != null) {
      dto.adbriefFound = !!j.adbrief_found;
      dto.adbriefCheckedAt = ts(j.adbrief_checked_at);
    }
    if (j.rejection_reason) dto.rejectionReason = j.rejection_reason;
    if (j.fix_category) dto.fixCategory = j.fix_category;
    if (j.fix_note) dto.fixNote = j.fix_note;
    if (j.outcome) dto.outcome = j.outcome;

    // Fase 4 takeout: kandidat individu dihapus — identitas job baru
    // tervalidasi gate AdBrief saat submit; matching registry lokal hanya
    // dipakai untuk resolusi baris bulk.
    if (j.mode === 'bulk') {
      dto.rows = (rowsByJob.get(j.id) ?? []).map((r: any) => {
        const row: NonNullable<VerifierJobDTO['rows']>[number] = {
          rowId: r.row_id,
          rowNo: r.row_no,
          nama: r.nama,
          tglLahir: r.tgl_iso ?? '',
          gender: r.gender ?? '',
          state: r.state as RowState,
          memberId: r.member_id ?? undefined,
          candidates: [] as MatchCandidate[],
        };
        if (row.state === 'unresolved') {
          row.candidates = findCandidates(row.nama, row.tglLahir, row.gender, registry);
        }
        if (r.consent_state) {
          row.consent = {
            state: r.consent_state as RowConsentState,
            fileIds: r.consent_file_ids ? String(r.consent_file_ids).split(',').filter(Boolean) : [],
            checkedAt: ts(r.consent_checked_at),
            checkedBy: r.consent_checked_by ?? undefined,
            note: r.consent_note ?? undefined,
          };
        }
        return row;
      });
    }
    return dto;
  });
}

export async function getJob(jobId: string): Promise<VerifierJobDTO | undefined> {
  const all = await listJobs();
  return all.find((j) => j.id === jobId);
}

/* ─── Audit ─── */

async function logAudit(jobId: string, action: string, actor: string, detail: string, outcome: string): Promise<void> {
  await pool.query(
    'INSERT INTO ad_score_verification_audit (job_id, action, actor, detail, outcome) VALUES (?, ?, ?, ?, ?)',
    [jobId, action, actor, detail.slice(0, 500), outcome.slice(0, 255)],
  );
}

export async function listAudit(jobId?: string): Promise<AuditEntryDTO[]> {
  await ensureSchema();
  const q = jobId
    ? 'SELECT * FROM ad_score_verification_audit WHERE job_id = ? ORDER BY created_at DESC, id DESC LIMIT 500'
    : 'SELECT * FROM ad_score_verification_audit ORDER BY created_at DESC, id DESC LIMIT 500';
  const [rows]: any = jobId ? await pool.query(q, [jobId]) : await pool.query(q);
  return (rows as any[]).map((r) => ({
    id: `AUD-${r.id}`,
    jobId: r.job_id ?? '',
    at: ts(r.created_at)!,
    action: r.action,
    actor: r.actor,
    detail: r.detail,
    outcome: r.outcome,
  }));
}

/* ─── Verifier operations ─── */

export class OpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function claimJob(jobId: string, actor: string): Promise<VerifierJobDTO> {
  await ensureSchema();
  const [res]: any = await pool.query(
    `UPDATE ad_score_verification_jobs
     SET status = 'on_progress', claimed_by = ?, claimed_at = NOW()
     WHERE id = ? AND status = 'submitted'`,
    [actor, jobId],
  );
  if (res.affectedRows === 0) {
    const job = await getJob(jobId);
    if (!job) throw new OpError(404, 'Job not found');
    throw new OpError(409, `Job sudah diklaim oleh ${job.claimedBy ?? 'verifier lain'}`);
  }
  await logAudit(jobId, 'claim', actor, 'Klaim job dari antrian', 'On Progress');
  const job = await getJob(jobId);
  if (!job) throw new OpError(404, 'Job not found');
  return job;
}

export async function checkConsent(jobId: string, fileId: string, checked: boolean, actor: string): Promise<VerifierJobDTO> {
  await ensureSchema();
  const job = await getJob(jobId);
  if (!job) throw new OpError(404, 'Job not found');
  if (!['submitted', 'on_progress'].includes(job.status)) {
    throw new OpError(409, 'Job harus aktif sebelum checklist consent bisa diubah');
  }
  const wasChecked = job.consentChecked.includes(fileId);
  const file = job.consentFiles.find((item) => item.id === fileId);
  if (!file) throw new OpError(404, 'Consent file tidak ditemukan');
  if (wasChecked === checked) return job;
  const [res]: any = checked
    ? await pool.query(
      'UPDATE ad_score_consent_files SET checked_by = ?, checked_at = NOW() WHERE id = ? AND job_id = ?',
      [actor, fileId, jobId],
    )
    : await pool.query(
      'UPDATE ad_score_consent_files SET checked_by = NULL, checked_at = NULL WHERE id = ? AND job_id = ?',
      [fileId, jobId],
    );
  if (res.affectedRows === 0) throw new OpError(404, 'Consent file tidak ditemukan');
  const updated = await getJob(jobId);
  if (!updated) throw new OpError(404, 'Job not found');
  await logAudit(
    jobId,
    checked ? 'consent_check' : 'consent_uncheck',
    actor,
    checked ? `${file.name} ✓` : `${file.name} — pemeriksaan dibatalkan`,
    `${updated.consentChecked.length}/${updated.consentFiles.length} diperiksa`,
  );
  return updated;
}

/**
 * Verifikasi dokumen persetujuan per member (bulk, strict).
 *
 * Aturan: verifikator WAJIB membuka dokumen (manual preview) sebelum memberi
 * keputusan — server menolak keputusan tanpa bukti fileId yang valid.
 * state 'unverified' membatalkan keputusan sebelumnya.
 * Keputusan 'match' otomatis menandai dokumen yang dirujuk sebagai reviewed
 * (menjaga gate legacy consentChecked tetap konsisten).
 */
export async function setRowConsent(
  jobId: string,
  rowId: string,
  state: RowConsentState,
  fileIds: string[],
  note: string | undefined,
  actor: string,
): Promise<VerifierJobDTO> {
  await ensureSchema();
  const job = await getJob(jobId);
  if (!job) throw new OpError(404, 'Job not found');
  if (!['submitted', 'on_progress'].includes(job.status)) {
    throw new OpError(409, 'Job harus aktif sebelum verifikasi consent bisa diubah');
  }
  if (job.mode !== 'bulk') {
    throw new OpError(422, 'Verifikasi consent per member hanya berlaku untuk job bulk');
  }
  const row = (job.rows ?? []).find((r) => r.rowId === rowId);
  if (!row) throw new OpError(404, 'Baris tidak ditemukan');
  if (row.state === 'unresolved') {
    throw new OpError(409, 'Selesaikan kecocokan baris sebelum verifikasi consent');
  }
  const current = row.consent?.state ?? 'unverified';
  if (current === state && state !== 'unverified') return job;
  const validFileIds = [...new Set(fileIds)].filter((id) => job.consentFiles.some((f) => f.id === id));
  if (state !== 'unverified' && validFileIds.length === 0) {
    throw new OpError(422, 'Buka dokumen persetujuan terlebih dahulu sebelum memberi keputusan');
  }
  await pool.query(
    `UPDATE ad_score_verification_rows
     SET consent_state = ?, consent_file_ids = ?, consent_checked_by = ?, consent_checked_at = NOW(), consent_note = ?
     WHERE row_id = ? AND job_id = ?`,
    [state, validFileIds.join(','), actor, note?.trim() || null, rowId, jobId],
  );
  if (state === 'match') {
    for (const fileId of validFileIds) {
      await pool.query(
        'UPDATE ad_score_consent_files SET checked_by = ?, checked_at = NOW() WHERE id = ? AND job_id = ?',
        [actor, fileId, jobId],
      );
    }
  }
  const updated = await getJob(jobId);
  if (!updated) throw new OpError(404, 'Job not found');
  const verdict = state === 'match' ? 'sesuai' : state === 'mismatch' ? 'TIDAK SESUAI' : 'dibatalkan';
  await logAudit(
    jobId,
    state === 'mismatch' ? 'consent_row_mismatch' : 'consent_row_check',
    actor,
    `Baris ${row.rowNo} (${row.nama}) — ${verdict}${note?.trim() ? `: ${note.trim()}` : ''}`,
    validFileIds.length ? `Dok: ${validFileIds.join(', ')}` : 'Reset',
  );
  return updated;
}

export async function resolveMatch(
  jobId: string,
  memberId: string | null,
  rowId: string | undefined,
  actor: string,
): Promise<VerifierJobDTO> {
  await ensureSchema();
  const job = await getJob(jobId);
  if (!job) throw new OpError(404, 'Job not found');
  if (!['submitted', 'on_progress'].includes(job.status)) {
    throw new OpError(409, 'Job harus aktif sebelum match diproses');
  }

  if (job.mode === 'individu') {
    // Fase 4 takeout: matching individu tidak digunakan lagi — identitas job
    // baru tervalidasi gate AdBrief saat submit. Job legacy tanpa validasi
    // AdBrief diselesaikan lewat reject / request-fix (selalu tersedia),
    // bukan lewat pick fuzzy registry lokal. Approve tetap terbuka hanya
    // untuk job legacy yang SUDAH ter-pick sebelum takeout (mid-flight).
    throw new OpError(422, 'Endpoint match individu tidak digunakan lagi');
  }
  if (rowId) {
    const row = (job.rows ?? []).find((r) => r.rowId === rowId);
    if (!row) throw new OpError(404, 'Baris tidak ditemukan');
    if (row.state !== 'unresolved') throw new OpError(409, 'Baris ini sudah diselesaikan');
    const state: RowState = memberId ? 'manual' : 'notfound';
    const [res]: any = await pool.query(
      'UPDATE ad_score_verification_rows SET state = ?, member_id = ? WHERE row_id = ? AND job_id = ?',
      [state, memberId, rowId, jobId],
    );
    if (res.affectedRows === 0) throw new OpError(404, 'Baris tidak ditemukan');
    const updated = await getJob(jobId);
    const resolvedRow = updated?.rows?.find((r) => r.rowId === rowId);
    await logAudit(jobId, 'match', actor, `Baris ${rowId} (${resolvedRow?.nama}) → ${memberId ? `cocok ${memberId}` : 'tidak ditemukan'}`, 'Resolved');
  } else {
    throw new OpError(422, 'rowId wajib untuk bulk');
  }
  const updated = await getJob(jobId);
  if (!updated) throw new OpError(404, 'Job not found');
  return updated;
}

export async function rejectJob(jobId: string, reason: string, actor: string): Promise<VerifierJobDTO> {
  await ensureSchema();
  const job = await getJob(jobId);
  if (!job) throw new OpError(404, 'Job not found');
  if (!['submitted', 'on_progress'].includes(job.status)) {
    throw new OpError(409, 'Job sudah dalam status final dan tidak bisa ditolak');
  }
  if (!reason.trim()) throw new OpError(422, 'Alasan wajib diisi');
  const [res]: any = await pool.query(
    `UPDATE ad_score_verification_jobs
     SET status = 'verified', rejection_reason = ?, outcome = 'Not Found — tidak ada kandidat di registry'
     WHERE id = ?`,
    [reason.trim(), jobId],
  );
  if (res.affectedRows === 0) throw new OpError(404, 'Job not found');
  await logAudit(jobId, 'reject', actor, reason.trim(), 'Not Found');
  const updated = await getJob(jobId);
  if (!updated) throw new OpError(404, 'Job not found');
  return updated;
}

export async function requestFix(jobId: string, category: string, note: string, actor: string): Promise<VerifierJobDTO> {
  await ensureSchema();
  const job = await getJob(jobId);
  if (!job) throw new OpError(404, 'Job not found');
  if (!['submitted', 'on_progress'].includes(job.status)) {
    throw new OpError(409, 'Job sudah dalam status final dan tidak bisa diminta perbaikan');
  }
  if (!note.trim()) throw new OpError(422, 'Catatan wajib diisi');
  const [res]: any = await pool.query(
    `UPDATE ad_score_verification_jobs
     SET status = 'verified', fix_category = ?, fix_note = ?, outcome = ?
     WHERE id = ?`,
    [category, note.trim(), `Request Fix — ${category}`, jobId],
  );
  if (res.affectedRows === 0) throw new OpError(404, 'Job not found');
  await logAudit(jobId, 'request_fix', actor, `${category} — ${note.trim()}`, 'Kembali ke client');
  const updated = await getJob(jobId);
  if (!updated) throw new OpError(404, 'Job not found');
  return updated;
}

/** Fase 3 — resolve member dari identitas pengajuan saat approve individu
 *  tanpa pick kandidat (job aliran baru, adbrief_found=1): exact match
 *  registry lokal; kalau belum terdaftar → INSERT member baru (source
 *  'upload-individu') sehingga member jadi searchable di Cari Data Member. */
async function resolveOrCreateMemberFromIdentity(
  identity: { nama: string; tglLahir: string; gender: string },
): Promise<string> {
  const registry = await loadRegistry();
  const nN = normalizeNama(identity.nama);
  const exact = registry.find(
    (m) => normalizeNama(m.nama) === nN && m.tglLahir === identity.tglLahir && m.gender === identity.gender,
  );
  if (exact) return exact.memberId;
  const memberId = await nextMemberId();
  await pool.query(
    'INSERT INTO ad_score_members (member_id, nama, tgl_lahir, gender, source) VALUES (?, ?, ?, ?, ?)',
    [memberId, identity.nama.trim(), identity.tglLahir, identity.gender, 'upload-individu'],
  );
  return memberId;
}

async function nextMemberId(): Promise<string> {
  const [rows]: any = await pool.query(
    "SELECT member_id FROM ad_score_members WHERE member_id LIKE 'ADM-%' ORDER BY LENGTH(member_id) DESC, member_id DESC LIMIT 1",
  );
  const last = String(rows[0]?.member_id ?? 'ADM-00000');
  const n = Number(last.slice(4));
  const seq = Number.isFinite(n) ? n + 1 : 1;
  return `ADM-${String(seq).padStart(5, '0')}`;
}

export async function verifyJob(jobId: string, actor: string): Promise<VerifierJobDTO> {
  await ensureSchema();
  const job = await getJob(jobId);
  if (!job) throw new OpError(404, 'Job not found');
  if (job.status !== 'on_progress') throw new OpError(409, 'Job harus On Progress sebelum diverifikasi');
  if (job.consentFiles.length > 0 && job.consentChecked.length !== job.consentFiles.length) {
    throw new OpError(422, 'Semua consent file harus diperiksa sebelum approve');
  }

  let outcome: string;
  if (job.mode === 'individu') {
    // Fase 3: job aliran baru (adbrief_found=1) tidak wajib pick kandidat —
    // identitas sudah tervalidasi gate AdBrief saat submit. Job lama (tanpa
    // kolom adbrief) tetap lewat jalur pick kandidat (backward-compat).
    if (!job.pickedMemberId && !job.adbriefFound) {
      throw new OpError(422, 'Pilih kandidat match atau tolak job terlebih dahulu');
    }
    let memberId = job.pickedMemberId;
    if (!memberId) {
      if (!job.identity) throw new OpError(422, 'Identitas job tidak lengkap untuk resolusi member');
      memberId = await resolveOrCreateMemberFromIdentity(job.identity);
      await pool.query('UPDATE ad_score_verification_jobs SET picked_member_id = ? WHERE id = ?', [memberId, jobId]);
    }
    outcome = `Verified → Success (${memberId})`;
  } else {
    const unresolved = (job.rows ?? []).filter((r) => r.state === 'unresolved').length;
    if (unresolved > 0) {
      throw new OpError(422, `${unresolved} baris masih belum di-resolve`);
    }
    // Strict per-member consent gate: setiap baris yang akan di-onboard
    // (auto/manual) wajib punya keputusan consent 'match'. Baris mismatch
    // memaksa verifikator memakai Minta Perbaikan / Tolak.
    const needConsent = (job.rows ?? []).filter(
      (r) => (r.state === 'auto' || r.state === 'manual') && (r.consent?.state ?? 'unverified') !== 'match',
    );
    if (needConsent.length > 0) {
      throw new OpError(422, `${needConsent.length} baris belum verifikasi dokumen persetujuan (consent per member)`);
    }
    const found = (job.rows ?? []).filter((r) => r.state === 'auto' || r.state === 'manual').length;
    const nf = (job.rows ?? []).filter((r) => r.state === 'notfound').length;
    outcome = `Bulk Confirmation — ${found} cocok, ${nf} tidak ditemukan`;
  }
  await pool.query(
    "UPDATE ad_score_verification_jobs SET status = 'completed', outcome = ? WHERE id = ?",
    [outcome, jobId],
  );
  await logAudit(jobId, 'approve', actor, 'Hasil verifikasi dikirim ke client', outcome);
  const updated = await getJob(jobId);
  if (!updated) throw new OpError(404, 'Job not found');
  return updated;
}

export async function cancelJob(jobId: string, actor: string, reason?: string): Promise<VerifierJobDTO> {
  await ensureSchema();
  const job = await getJob(jobId);
  if (!job) throw new OpError(404, 'Job not found');
  if (job.status === 'completed') {
    throw new OpError(409, 'Job sudah selesai dan tidak dapat dibatalkan');
  }
  if (job.status === 'cancelled') {
    return job;
  }
  const cancelReason = reason?.trim() || 'Dibatalkan oleh pemohon';
  const outcome = cancelReason;
  await pool.query(
    "UPDATE ad_score_verification_jobs SET status = 'cancelled', outcome = ? WHERE id = ?",
    [outcome, jobId],
  );
  await logAudit(jobId, 'cancel', actor, cancelReason, 'Cancelled');
  const updated = await getJob(jobId);
  if (!updated) throw new OpError(404, 'Job not found');
  return updated;
}

export async function unclaimJob(jobId: string, actor: string): Promise<VerifierJobDTO> {
  await ensureSchema();
  const job = await getJob(jobId);
  if (!job) throw new OpError(404, 'Job not found');
  if (job.status !== 'on_progress') {
    throw new OpError(409, 'Job tidak sedang dalam status on_progress');
  }
  await pool.query(
    "UPDATE ad_score_verification_jobs SET status = 'submitted', claimed_by = NULL, claimed_at = NULL WHERE id = ?",
    [jobId],
  );
  await logAudit(jobId, 'unclaim', actor, 'Klaim job dibatalkan — dikembalikan ke antrean', 'Submitted');
  const updated = await getJob(jobId);
  if (!updated) throw new OpError(404, 'Job not found');
  return updated;
}

/* ─── Client onboarding operations ─── */

export interface SubmitPayload {
  mode: JobMode;
  identity?: { nama: string; tglLahir: string; gender: string };
  dataFileName?: string;
  dataFileRows?: number;
  consentFiles: Array<{ name: string; size: number; type: string }>;
  rows?: Array<{ nama: string; tglLahir: string; gender: string }>;
}

export interface ConsentFileUpload {
  name: string;
  size: number;
  type: string;
  content: Buffer;
}

export interface ConsentFileContent {
  name: string;
  type: string;
  content: Buffer;
}

export async function getConsentFileContent(jobId: string, fileId: string): Promise<ConsentFileContent> {
  await ensureSchema();
  const [rows]: any = await pool.query(
    'SELECT name, type, size, OCTET_LENGTH(content) AS content_size FROM ad_score_consent_files WHERE id = ? AND job_id = ? LIMIT 1',
    [fileId, jobId],
  );
  const file = rows[0];
  if (!file) throw new OpError(404, 'Consent file not found');

  const parts: Buffer[] = [];
  const [storedChunks]: any = await pool.query(
    'SELECT content FROM ad_score_consent_file_chunks WHERE file_id = ? ORDER BY chunk_no',
    [fileId],
  );
  if (storedChunks.length > 0) {
    for (const chunk of storedChunks) parts.push(Buffer.from(chunk.content));
  } else {
    if (file.content_size == null) throw new OpError(404, 'Konten dokumen belum tersedia; minta pengaju mengunggah ulang file');
    const legacySize = Number(file.content_size);
    for (let offset = 0; offset < legacySize; offset += BLOB_CHUNK_SIZE) {
      const [legacyChunks]: any = await pool.query(
        'SELECT SUBSTRING(content, ?, ?) AS chunk FROM ad_score_consent_files WHERE id = ? AND job_id = ? LIMIT 1',
        [offset + 1, Math.min(BLOB_CHUNK_SIZE, legacySize - offset), fileId, jobId],
      );
      if (!legacyChunks[0]?.chunk) throw new OpError(404, 'Konten dokumen belum lengkap; minta pengaju mengunggah ulang file');
      parts.push(Buffer.from(legacyChunks[0].chunk));
    }
  }
  const content = Buffer.concat(parts);
  if (content.length !== Number(file.size)) {
    throw new OpError(404, 'Konten dokumen belum lengkap; minta pengaju mengunggah ulang file');
  }
  return { name: file.name, type: file.type, content };
}

async function nextJobId(): Promise<string> {
  const year = new Date().getFullYear();
  const [rows]: any = await pool.query(
    "SELECT COUNT(*) AS n FROM ad_score_verification_jobs WHERE id LIKE ?",
    [`JOB-${year}-%`],
  );
  const seq = Number(rows[0].n) + 1;
  return `JOB-${year}-${String(seq).padStart(4, '0')}`;
}

export async function submitOnboardingJob(
  payload: SubmitPayload,
  actor: string,
  uploadedFiles: ConsentFileUpload[],
  userToken: string,
): Promise<{ jobId: string }> {
  await ensureSchema();
  if (!uploadedFiles.length || uploadedFiles.length !== payload.consentFiles?.length) {
    throw new OpError(422, 'Konten file consent tidak lengkap; unggah ulang dokumen');
  }
  let adbriefFound = false;
  // Fase 5: hasil gerbang AdBrief per baris bulk ('' = found, buat member
  // baru saat transaksi; null = tidak ditemukan di AdBrief).
  let bulkGate: Array<{ found: boolean; memberId: string | null }> = [];
  let bulkAdBriefSummary = '';
  if (payload.mode === 'individu') {
    const id = payload.identity;
    if (!id || !id.nama?.trim() || !id.tglLahir || !['M', 'F'].includes(id.gender)) {
      throw new OpError(422, 'identity { nama, tglLahir, gender } wajib untuk individu');
    }
    if (!payload.consentFiles?.length) {
      throw new OpError(422, 'Minimal 1 file consent wajib diunggah');
    }
    // ── Gerbang check-member AdBrief (Fase 1, fail-closed) ──────────────
    // Identitas individu WAJIB terverifikasi di registry keanggotaan
    // AdMedika sebelum job dibuat. Service down / tidak terkonfigurasi →
    // submit ditolak (503/504/502); member tidak ada → 422 'Data Member
    // Tidak Ada'. Tidak ada penulisan DB sebelum gate ini lolos.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(id.tglLahir)) {
      throw new OpError(422, 'Format tanggal lahir harus YYYY-MM-DD');
    }
    const adbriefCheck = await checkMemberAdBrief(
      { member_name: id.nama.trim(), dob: id.tglLahir, gender: id.gender as 'M' | 'F' },
      userToken,
    );
    if (!adbriefCheck.ok) throw new OpError(adbriefCheck.status, adbriefCheck.message);
    if (!adbriefCheck.found) throw new OpError(422, adbriefCheck.message);
    adbriefFound = true;
  } else {
    if (!payload.dataFileName?.trim() || !payload.consentFiles?.length || !payload.rows?.length) {
      throw new OpError(422, 'File XLSX harus berisi data member valid dan minimal 1 consent wajib untuk bulk');
    }
    // ── Gerbang check-member AdBrief per baris (Fase 5, fail-closed) ──
    // Setiap baris WAJIB terdaftar di registry keanggotaan AdMedika:
    //   - baris tidak terdaftar → state 'notfound' (tidak di-onboard)
    //   - SEMUA baris tidak terdaftar → 422, job tidak dibuat
    //   - layanan gagal (down/timeout) → 502/503/504, job tidak dibuat
    // Tidak ada penulisan DB sebelum seluruh baris lolos gerbang.
    const registry = await loadRegistry();
    const batch = await checkMemberBatch(
      payload.rows.map((row) => ({ member_name: row.nama, dob: row.tglLahir, gender: row.gender as 'M' | 'F' })),
      userToken,
    );
    const failedRow = batch.findIndex((r) => r.error != null);
    if (failedRow !== -1) {
      const row = payload.rows[failedRow];
      throw new OpError(batch[failedRow].error ?? 502, `Baris ${failedRow + 1} (${row.nama}): ${batch[failedRow].message}`);
    }
    const foundCount = batch.filter((r) => r.found).length;
    if (foundCount === 0) {
      throw new OpError(422, 'Semua baris tidak ditemukan di AdBrief — tidak ada pengajuan yang dapat dibuat');
    }
    adbriefFound = true;
    bulkGate = payload.rows.map((row, i) => {
      if (!batch[i].found) return { found: false, memberId: null };
      const nN = normalizeNama(row.nama);
      const exact = registry.find(
        (m) => normalizeNama(m.nama) === nN && m.tglLahir === row.tglLahir && m.gender === row.gender,
      );
      return { found: true, memberId: exact ? exact.memberId : '' };
    });
    bulkAdBriefSummary = `${foundCount} cocok, ${payload.rows.length - foundCount} tidak ditemukan`;
  }

  let jobId = await nextJobId();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    let nextBulkMemberSequence: number | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await connection.query(
        `INSERT INTO ad_score_verification_jobs
          (id, mode, status, submitted_by, identity_nama, identity_tgl, identity_gender,
           adbrief_found, adbrief_checked_at, data_file_name, data_file_rows)
         VALUES (?, ?, 'submitted', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          jobId, payload.mode, actor,
          payload.identity?.nama ?? null, payload.identity?.tglLahir || null, payload.identity?.gender ?? null,
          adbriefFound ? 1 : null,
          adbriefFound ? new Date() : null,
          payload.mode === 'bulk' ? payload.dataFileName ?? null : null,
          payload.mode === 'bulk' ? payload.dataFileRows ?? null : null,
        ],
      );
        break;
      } catch (e: any) {
        if (e?.code === 'ER_DUP_ENTRY' && attempt < 2) {
          jobId = await nextJobId();
          continue;
        }
        throw e;
      }
    }

    for (const [index, f] of payload.consentFiles.entries()) {
      const fileId = `CF-${randomBytes(4).toString('hex').toUpperCase()}`;
      const content = uploadedFiles[index].content;
      await connection.query(
        'INSERT INTO ad_score_consent_files (id, job_id, name, size, type, content) VALUES (?, ?, ?, ?, ?, ?)',
        [fileId, jobId, f.name, f.size, f.type || 'application/octet-stream', null],
      );
      for (let offset = 0, chunkNo = 0; offset < content.length; offset += BLOB_CHUNK_SIZE, chunkNo++) {
        await connection.query(
          'INSERT INTO ad_score_consent_file_chunks (file_id, chunk_no, content) VALUES (?, ?, ?)',
          [fileId, chunkNo, content.subarray(offset, offset + BLOB_CHUNK_SIZE)],
        );
      }
    }

    if (payload.mode === 'bulk') {
      const source = payload.rows ?? [];
      for (let i = 0; i < source.length; i++) {
        const row = source[i];
        const gate = bulkGate[i] ?? { found: false, memberId: null };
        let state: RowState = 'notfound';
        let memberId: string | null = null;
        if (gate.found) {
          // Baris terdaftar di AdBrief: pakai exact match registry lokal
          // bila ada; selain itu materialize member baru (registry = data
          // keanggotaan, independen dari hasil consent) → state 'auto',
          // verifier consent-only (konsisten dengan aliran individu).
          state = 'auto';
          if (gate.memberId) {
            memberId = gate.memberId;
          } else {
            if (nextBulkMemberSequence === null) {
              const [members]: any = await connection.query(
                "SELECT member_id FROM ad_score_members WHERE member_id LIKE 'ADM-%' ORDER BY LENGTH(member_id) DESC, member_id DESC LIMIT 1 FOR UPDATE",
              );
              const last = String(members[0]?.member_id ?? 'ADM-00000');
              const sequence = Number(last.slice(4));
              nextBulkMemberSequence = Number.isFinite(sequence) ? sequence + 1 : 1;
            }
            memberId = `ADM-${String(nextBulkMemberSequence).padStart(5, '0')}`;
            nextBulkMemberSequence++;
            await connection.query(
              'INSERT INTO ad_score_members (member_id, nama, tgl_lahir, gender, source) VALUES (?, ?, ?, ?, ?)',
              [memberId, row.nama.trim(), row.tglLahir, row.gender, 'upload-bulk'],
            );
          }
        }
        await connection.query(
          `INSERT INTO ad_score_verification_rows (row_id, job_id, row_no, nama, tgl_lahir, gender, state, member_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [`${jobId}-r${i + 1}`, jobId, i + 1, row.nama, row.tglLahir || null, row.gender || null, state, memberId],
        );
      }
    }

    await connection.query(
      'INSERT INTO ad_score_verification_audit (job_id, action, actor, detail, outcome) VALUES (?, ?, ?, ?, ?)',
      [jobId, 'submit', actor, payload.mode === 'individu' ? `Submit individu: ${payload.identity!.nama} (AdBrief: Found)` : `Submit bulk: ${payload.dataFileName} — ${payload.rows?.length ?? 0} baris (AdBrief: ${bulkAdBriefSummary})`, 'Submitted'],
    );
    await connection.commit();
    return { jobId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/** Fase 5 — audit aksi check-member eksplisit dari Cari Data Member
 *  (context='member-search'). Pre-check UX di modal upload TIDAK di-audit
 *  agar tidak membanjiri audit trail (auto-check per keystroke debounce). */
export async function logCheckMemberAudit(
  actorName: string,
  identity: CheckMemberIdentity,
  found: boolean,
): Promise<void> {
  await ensureSchema();
  await pool.query(
    'INSERT INTO ad_score_verification_audit (job_id, action, actor, detail, outcome) VALUES (NULL, ?, ?, ?, ?)',
    ['check_member', actorName, `${identity.member_name} · ${identity.dob} · ${identity.gender}`, found ? 'Found' : 'Not Found'],
  );
}

/**
 * Klasifikasi verdict per baris bulk — sumber kebenaran layar
 * "Konfirmasi Hasil Pencarian Bulk".
 *
 * Aturan:
 * - `ready`            → member ditemukan DAN dokumen persetujuan sesuai
 *                        → satu-satunya jalur ke Dashboard AdScore.
 * - `consent-mismatch` → member ditemukan TAPI consent tidak sesuai.
 * - `member-not-found` → data member tidak ada di registry.
 * - `unresolved`       → verifikator belum dapat memutuskan.
 *
 * Catatan baris: pakai temuan verifikator bila tersedia (consent_note /
 * fixNote), jika tidak pakai pesan default per verdict.
 */
function classifyBulkRows(
  dto: VerifierJobDTO,
  registry: RegistryRow[],
): Array<{
  rowNo: number;
  nama: string;
  tglLahir: string | null;
  gender: string | null;
  memberState: 'found' | 'notfound';
  memberId?: string;
  consentState: 'match' | 'mismatch' | 'unverified' | 'none';
  verdict: 'ready' | 'consent-mismatch' | 'member-not-found' | 'unresolved';
  note?: string;
}> {
  return (dto.rows ?? []).map((r) => {
    const m = r.memberId ? registry.find((x) => x.memberId === r.memberId) : undefined;
    const memberFound = (r.state === 'auto' || r.state === 'manual') && !!m;
    const consentState: 'match' | 'mismatch' | 'unverified' | 'none' = r.consent?.state ?? 'none';
    let verdict: 'ready' | 'consent-mismatch' | 'member-not-found' | 'unresolved';
    if (r.state === 'unresolved') verdict = 'unresolved';
    else if (!memberFound) verdict = 'member-not-found';
    else if (consentState !== 'match') verdict = 'consent-mismatch';
    else verdict = 'ready';
    const fixNoteFor = (rowNo: number): string | undefined => {
      const line = dto.fixNote
        ?.split('\n')
        .map((l) => l.trim())
        .find((l) => l.toLowerCase().startsWith(`baris ${rowNo} `) || l.toLowerCase().startsWith(`row ${rowNo} `));
      return line?.replace(/^(baris|row)\s+\d+\s*\(([^)]+)\)\s*:\s*/i, `$2: `);
    };
    const note =
      r.consent?.note ??
      fixNoteFor(r.rowNo) ??
      (verdict === 'member-not-found'
        ? 'Nama tidak cocok dengan data keanggotaan (periksa ejaan / format tanggal)'
        : verdict === 'unresolved'
          ? 'Belum dapat diverifikasi oleh verifikator — perlu diajukan ulang'
          : verdict === 'consent-mismatch'
            ? 'Dokumen persetujuan tidak sesuai dengan data member'
            : undefined);
    return {
      rowNo: r.rowNo,
      nama: r.nama,
      tglLahir: r.tglLahir,
      gender: r.gender,
      memberState: memberFound ? ('found' as const) : ('notfound' as const),
      memberId: m?.memberId,
      consentState,
      verdict,
      note,
    };
  });
}

/** Baris gagal bulk untuk job tertentu (akses: submitter atau verifikator). */
export async function listOnboardingFailedRows(
  jobId: string,
  requester: { username: string; role: string },
): Promise<unknown> {
  const dto = await getJob(jobId);
  if (!dto) throw new OpError(404, 'Job tidak ditemukan');
  const isPrivileged = ['SUPER_ADMIN', 'ADMIN', 'ADSCORE_VERIFIER'].includes(requester.role);
  if (!isPrivileged && dto.submittedBy !== requester.username) {
    throw new OpError(403, 'Job ini bukan milik user Anda');
  }
  if (dto.mode !== 'bulk') throw new OpError(400, 'Template baris gagal hanya untuk job bulk');
  if (dto.status !== 'verified' && dto.status !== 'completed') {
    throw new OpError(409, 'Verifikasi belum selesai — baris gagal belum tersedia');
  }
  const registry = await loadRegistry();
  return classifyBulkRows(dto, registry).filter((r) => r.verdict !== 'ready');
}

/** Client-visible job: status + synthesized timeline + computed result. */
export async function getOnboardingJob(
  jobId: string,
  requester: { username: string; role: string },
): Promise<{ job: Record<string, unknown> } | undefined> {
  const dto = await getJob(jobId);
  if (!dto) return undefined;
  const isPrivileged = ['SUPER_ADMIN', 'ADMIN', 'ADSCORE_VERIFIER'].includes(requester.role);
  if (!isPrivileged && dto.submittedBy !== requester.username) {
    throw new OpError(403, 'Job ini bukan milik user Anda');
  }

  if (dto.status === 'cancelled') {
    return {
      job: {
        id: dto.id,
        mode: dto.mode,
        status: 'cancelled',
        createdAt: dto.createdAt,
        timeline: [
          { status: 'submitted', at: dto.createdAt },
          { status: 'cancelled', at: Date.now() },
        ],
        outcome: dto.outcome ?? 'Antrean dibatalkan',
      },
    };
  }

  const registry = await loadRegistry();
  const terminal = dto.status === 'verified' || dto.status === 'completed';
  const clientStatus: JobStatus = terminal ? 'completed' : dto.status;

  let result: Record<string, unknown> | undefined;
  if (terminal) {
    if (dto.mode === 'individu') {
      if (dto.pickedMemberId) {
        const m = registry.find((x) => x.memberId === dto.pickedMemberId);
        if (m) {
          result = {
            kind: 'success',
            member: { memberId: m.memberId, nama: m.nama, tglLahir: m.tglLahir, gender: m.gender, registeredAt: m.registeredAt, source: m.source === 'seed' ? 'demo' : m.source },
            consentFiles: dto.consentFiles.map((f) => ({ name: f.name, size: f.size, type: f.type, uploadedAt: f.uploadedAt })),
          };
        }
      } else {
        const reason = dto.rejectionReason
          ? dto.rejectionReason
          : dto.fixCategory
            ? `Perlu perbaikan (${dto.fixCategory}): ${dto.fixNote ?? ''}`
            : 'Data tidak ditemukan dalam registry keanggotaan';
        result = {
          kind: 'notfound',
          identity: dto.identity ?? { nama: '', tglLahir: '', gender: '' },
          reason,
        };
      }
    } else {
      // Fase 6 — klasifikasi verdict per baris (helper di atas).
      const bulkRows = classifyBulkRows(dto, registry);
      // Backward-compat: `found` kini HANYA baris siap lanjut (member ditemukan
      // + consent sesuai) — bukan lagi semua baris auto/manual.
      const found = bulkRows
        .filter((r) => r.verdict === 'ready' && r.memberId)
        .map((r) => {
          const m = registry.find((x) => x.memberId === r.memberId);
          return m
            ? { memberId: m.memberId, nama: m.nama, tglLahir: m.tglLahir, gender: m.gender, registeredAt: m.registeredAt, source: m.source === 'seed' ? 'demo' : m.source }
            : null;
        })
        .filter(Boolean);
      const notFound = bulkRows
        .filter((r) => r.memberState === 'notfound')
        .map((r) => ({ nama: r.nama, tglLahir: r.tglLahir, gender: r.gender, reason: r.note ?? '' }));
      const needReupload = bulkRows.filter((r) => r.verdict !== 'ready');
      result = {
        kind: 'bulk',
        fileName: dto.dataFile?.name ?? '',
        totalRows: bulkRows.length,
        rows: bulkRows,
        ready: found,
        needReupload,
        found,
        notFound,
        consentFiles: dto.consentFiles.map((f) => ({ name: f.name, size: f.size, type: f.type, uploadedAt: f.uploadedAt })),
      };
    }
  }

  return {
    job: {
      id: dto.id,
      mode: dto.mode,
      status: clientStatus,
      createdAt: dto.createdAt,
      timeline: [
        { status: 'submitted', at: dto.createdAt },
        { status: 'on_progress', at: dto.claimedAt ?? dto.createdAt },
        { status: 'verified', at: terminal ? dto.createdAt + 1 : dto.createdAt },
        { status: 'completed', at: terminal ? dto.createdAt + 2 : dto.createdAt },
      ],
      result,
      // Fase 6 — temuan verifikator diteruskan ke client agar pengaju tahu
      // apa yang harus diperbaiki (sebelumnya hanya tersedia di sisi verifier).
      outcome: dto.outcome,
      fixCategory: dto.fixCategory,
      fixNote: dto.fixNote,
    },
  };
}

export interface OnboardingTrackingDTO {
  jobId: string;
  mode: JobMode;
  status: JobStatus;
  createdAt: number;
  dataFileName?: string;
  consentFiles: Array<{ name: string; size: number; type: string; uploadedAt: number }>;
}

/** Active onboarding jobs belonging to the authenticated submitter. */
export async function listOnboardingJobs(username: string): Promise<OnboardingTrackingDTO[]> {
  await ensureSchema();
  const [rows]: any = await pool.query(
    `SELECT j.id, j.mode, j.status, j.created_at, j.data_file_name,
            c.name AS consent_name, c.size AS consent_size, c.type AS consent_type, c.uploaded_at
       FROM ad_score_verification_jobs j
       LEFT JOIN ad_score_consent_files c ON c.job_id = j.id
      WHERE j.submitted_by = ? AND j.status IN ('submitted', 'on_progress')
      ORDER BY j.created_at DESC, c.uploaded_at ASC`,
    [username],
  );
  const jobs = new Map<string, OnboardingTrackingDTO>();
  for (const row of rows as any[]) {
    let job = jobs.get(row.id);
    if (!job) {
      job = {
        jobId: row.id,
        mode: row.mode,
        status: row.status,
        createdAt: ts(row.created_at) ?? Date.now(),
        dataFileName: row.data_file_name ?? undefined,
        consentFiles: [],
      };
      jobs.set(row.id, job);
    }
    if (row.consent_name) {
      job.consentFiles.push({
        name: row.consent_name,
        size: Number(row.consent_size),
        type: row.consent_type,
        uploadedAt: ts(row.uploaded_at) ?? job.createdAt,
      });
    }
  }
  return [...jobs.values()];
}

/** Gerbang hasil verifikasi untuk Cari Data Member: keputusan verifikasi
 * TERAKHIR yang melibatkan member harus "siap lanjut", bukan sekadar
 * tidak ada job aktif. */
export interface MemberSearchGate {
  blocked: 'consent-mismatch' | 'not-ready';
  reason: string;
  jobId: string;
}

/** Exact-normalized member search (client top filter bar). */
export async function searchMembers(filter: { nama?: string; tglLahir?: string; gender?: string }): Promise<{ found: boolean; member?: MemberDTO; total: number; pendingVerification?: boolean; verificationGate?: MemberSearchGate }> {
  await ensureSchema();
  const registry = await loadRegistry();
  const total = registry.length;
  const nama = filter.nama ? normalizeNama(filter.nama) : '';
  if (!nama) return { found: false, total };
  const member = registry.find((m) => {
    if (normalizeNama(m.nama) !== nama) return false;
    if (filter.tglLahir && m.tglLahir !== filter.tglLahir) return false;
    if (filter.gender && m.gender !== filter.gender) return false;
    return true;
  });
  if (!member) return { found: false, total };
  const dto: MemberDTO = { memberId: member.memberId, nama: member.nama, tglLahir: member.tglLahir, gender: member.gender, registeredAt: member.registeredAt, source: member.source === 'seed' ? 'demo' : member.source };

  // ── Gate alur verifikasi: member yang MASIH memiliki job verifikasi aktif
  // (status 'submitted'/'on_progress') tidak boleh membuka dashboard AdScore
  // dari Cari Data Member — hasil verifikasi dokumen harus selesai dulu.
  // Dua jalur pengecekan:
  //   1) member hasil materialize job bulk aktif (rows.member_id terisi saat
  //      submit bulk) — status DB 'submitted'/'on_progress' belum terminal;
  //   2) identitas job individu aktif yang cocok (re-verifikasi member lama).
  // Status DB 'verified'/'completed' dianggap selesai (terminal) di sini.
  const [pendingJobs]: any = await pool.query(
    `SELECT j.mode, j.identity_nama, DATE_FORMAT(j.identity_tgl, '%Y-%m-%d') AS identity_tgl_iso, j.identity_gender, r.member_id
       FROM ad_score_verification_jobs j
       LEFT JOIN ad_score_verification_rows r ON r.job_id = j.id
      WHERE j.status IN ('submitted', 'on_progress')`,
  );
  const pendingVerification = (pendingJobs as any[]).some((p) => {
    if (p.member_id && p.member_id === member.memberId) return true;
    if (p.mode === 'individu' && p.identity_nama) {
      return (
        normalizeNama(String(p.identity_nama)) === normalizeNama(member.nama) &&
        (p.identity_tgl_iso ?? '') === member.tglLahir &&
        (p.identity_gender ?? '') === member.gender
      );
    }
    return false;
  });
  if (pendingVerification) {
    return { found: true, total, pendingVerification: true, member: dto };
  }

  // ── Gate keputusan verifikasi TERAKHIR (strict) ─────────────────────────
  // Member yang baris/identitasnya pernah diverifikasi TIDAK boleh membuka
  // dashboard AdScore bila keputusan verifikator terakhir bukan "siap
  // lanjut": consent mismatch ("Tidak sesuai dokument"), request-fix, atau
  // ditolak. Member materialized saat submit bulk tetap ada di registry —
  // keberadaan di registry BUKAN bukti lolos verifikasi dokumen.
  const [bulkHistory]: any = await pool.query(
    `SELECT j.id, j.status, j.outcome, j.fix_category, j.rejection_reason,
            r.state AS row_state, r.consent_state, j.updated_at AS upd
       FROM ad_score_verification_rows r
       JOIN ad_score_verification_jobs j ON j.id = r.job_id
      WHERE r.member_id = ? AND j.status IN ('verified', 'completed')
      ORDER BY j.updated_at DESC, j.created_at DESC`,
    [member.memberId],
  );
  const [individuHistory]: any = await pool.query(
    `SELECT j.id, j.status, j.outcome, j.fix_category, j.rejection_reason,
            j.identity_nama, j.identity_gender,
            DATE_FORMAT(j.identity_tgl, '%Y-%m-%d') AS identity_tgl_iso,
            j.updated_at AS upd
       FROM ad_score_verification_jobs j
      WHERE j.mode = 'individu' AND j.status IN ('verified', 'completed')
        AND j.identity_nama IS NOT NULL`,
  );
  const normId = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const events: Array<Record<string, unknown> & { kind: 'bulk' | 'individu' }> = [
    ...(bulkHistory as any[]).map((r) => ({ kind: 'bulk' as const, ...r })),
    ...(individuHistory as any[])
      .filter(
        (j) =>
          normId(j.identity_nama) === normId(member.nama) &&
          String(j.identity_tgl_iso ?? '') === member.tglLahir &&
          String(j.identity_gender ?? '') === member.gender,
      )
      .map((j) => ({ kind: 'individu' as const, ...j })),
  ].sort((a, b) => new Date(b.upd).getTime() - new Date(a.upd).getTime());

  for (const ev of events) {
    // Keputusan efektif:
    // - individu: approve = status 'completed'.
    // - bulk: keputusan per-BARIS member ini, bukan per-job — satu job
    //   request-fix bisa mixed (baris A mismatch, baris B ready). Job
    //   legacy ter-approve ('Bulk Confirmation' / 'completed') dianggap
    //   ready seluruh barisnya (gate consent belum ada saat itu).
    if (ev.kind === 'individu') {
      if (ev.status === 'completed') break; // keputusan terakhir: siap lanjut
    } else {
      const jobApproved =
        ev.status === 'completed' || String(ev.outcome ?? '').startsWith('Bulk Confirmation');
      const rowReady =
        jobApproved ||
        ((ev.row_state === 'auto' || ev.row_state === 'manual') && ev.consent_state === 'match');
      if (rowReady) break; // baris member ini siap lanjut → boleh dibuka
    }
    const consentMismatch = ev.kind === 'bulk' && ev.consent_state === 'mismatch';
    const fixCategory = String(ev.fix_category ?? '').trim();
    const rejectionReason = String(ev.rejection_reason ?? '').trim();
    const fixReason = fixCategory
      ? `Perlu perbaikan (${fixCategory}): ${rejectionReason || 'hasil verifikasi belum siap lanjut'}`
      : rejectionReason || 'Hasil verifikasi terakhir belum siap lanjut.';
    const reason = consentMismatch
      ? 'Dokumen persetujuan TIDAK SESUAI dengan data member (temuan verifikator terakhir). Perbaiki dokumen lalu ajukan ulang.'
      : ev.kind === 'individu' && !fixCategory && !rejectionReason
        ? 'Pengajuan terakhir ditolak verifikator.'
        : fixReason;
    return {
      found: true,
      total,
      member: dto,
      verificationGate: {
        blocked: consentMismatch ? 'consent-mismatch' : 'not-ready',
        reason,
        jobId: String(ev.id),
      },
    };
  }
  return { found: true, total, member: dto };
}