/**
 * AdScore Member Onboarding — domain types.
 *
 * Covers: search filter, upload (individu / bulk), async job processing
 * (Submitted → On Progress → Verified → Completed) and verification results
 * (success / not found / bulk confirmation).
 */

/** Page-level stage machine (before the ADScore dashboard). */
export type OnboardingStage =
  | 'search'
  | 'empty'
  | 'processing'
  | 'result-success'
  | 'result-notfound'
  | 'bulk-confirm'
  | 'dashboard';

/** Async job status — 4-stage stepper. */
export type JobStatus = 'submitted' | 'on_progress' | 'verified' | 'completed' | 'cancelled';

export type MemberGender = 'M' | 'F';

/** Core identity used for search / upload / registry matching. */
export interface MemberIdentity {
  nama: string;
  /** ISO format YYYY-MM-DD (native date input value). */
  tglLahir: string;
  gender: MemberGender;
}

/** A member registered in the (demo) AdMedika network dataset. */
export interface RegisteredMember extends MemberIdentity {
  memberId: string;
  registeredAt: number;
  source: 'demo' | 'upload-individu' | 'upload-bulk';
}

/** Metadata of an uploaded consent file (audit trail). */
export interface ConsentFileMeta {
  name: string;
  size: number;
  type: string;
  uploadedAt: number;
}

/** Row that failed to match during bulk verification. */
export interface BulkNotFoundRow extends MemberIdentity {
  reason: string;
}

/**
 * Verdict verifikasi per baris bulk.
 * - `ready`            → member ditemukan DAN dokumen persetujuan sesuai → boleh buka Dashboard AdScore.
 * - `consent-mismatch` → member ditemukan TAPI dokumen persetujuan tidak sesuai → wajib upload ulang.
 * - `member-not-found` → data member tidak ditemukan di registry → wajib upload ulang.
 * - `unresolved`       → verifikator belum dapat memutuskan → wajib upload ulang.
 */
export type BulkRowVerdict = 'ready' | 'consent-mismatch' | 'member-not-found' | 'unresolved';

/** Status verifikasi dokumen persetujuan satu baris bulk. */
export type BulkRowConsentState = 'match' | 'mismatch' | 'unverified' | 'none';

/** Hasil verifikasi satu baris bulk — sumber kebenaran klasifikasi di UI. */
export interface BulkRowResult extends MemberIdentity {
  rowNo: number;
  memberState: 'found' | 'notfound';
  memberId?: string;
  consentState: BulkRowConsentState;
  verdict: BulkRowVerdict;
  /** Temuan verifikator / alasan baris tidak dapat lanjut. */
  note?: string;
}

/** Final result of an onboarding job. */
export type JobResult =
  | {
      kind: 'success';
      member: RegisteredMember;
      consentFiles: ConsentFileMeta[];
    }
  | {
      kind: 'notfound';
      identity: MemberIdentity;
      reason: string;
    }
  | {
      kind: 'bulk';
      fileName: string;
      totalRows: number;
      /** Klasifikasi verdict per baris — sumber kebenaran layar konfirmasi bulk. */
      rows: BulkRowResult[];
      /** Baris yang boleh lanjut ke Dashboard AdScore (member ditemukan + consent sesuai). */
      ready: RegisteredMember[];
      /** Baris yang wajib diunggah ulang (consent tidak sesuai / tidak ditemukan / belum terverifikasi). */
      needReupload: BulkRowResult[];
      /** @deprecated gunakan `ready` — dipertahankan untuk kompatibilitas. */
      found: RegisteredMember[];
      notFound: BulkNotFoundRow[];
      consentFiles: ConsentFileMeta[];
    };

/** Async onboarding job tracked by the stepper. */
export interface OnboardingJob {
  id: string;
  mode: 'individu' | 'bulk';
  status: JobStatus;
  createdAt: number;
  /** Timestamped progression for the stepper. */
  timeline: Array<{ status: JobStatus; at: number }>;
  result?: JobResult;
  /** Ringkasan hasil dari verifikator (mis. "Request Fix — consent"). */
  outcome?: string;
  /** Kategori perbaikan yang diminta verifikator. */
  fixCategory?: string;
  /** Catatan/temuan verifikator — instruksi perbaikan untuk pengaju. */
  fixNote?: string;
}

/** Payload submitted from the "Individu" tab. */
export interface IndividuSubmitPayload extends MemberIdentity {
  consentFiles: ConsentFileMeta[];
}

/** Payload submitted from the "Bulk Excel" tab. */
export interface BulkSubmitPayload {
  dataFileName: string;
  dataFileSize: number;
  consentFiles: ConsentFileMeta[];
}

/** Search filter values from the top filter bar. */
export interface MemberSearchFilter {
  nama: string;
  tglLahir: string;
  /** '' = not filtered. */
  gender: '' | MemberGender;
}

/** Empty-state variant shown under the filter bar. */
export type EmptyVariant = 'no-data' | 'not-found' | 'verification-pending' | 'verification-blocked';