import type { ConsentFileMeta, OnboardingJob } from '../model/onboardingTypes';

/** Slot legacy single-job (sebelum multi-job tracking) — dipertahankan untuk migrasi. */
export const ACTIVE_TRACKING_KEY = 'adscore-member-active-tracking';
/** Key list: SEMUA job onboarding yang masih proses dilacak bersamaan. */
export const ACTIVE_TRACKING_LIST_KEY = 'adscore-member-active-tracking-list';

export interface ActiveTrackingDetails {
  jobId: string;
  dataFileName?: string;
  consentFiles: ConsentFileMeta[];
  job: OnboardingJob;
}

function isValidDetails(value: unknown): value is ActiveTrackingDetails {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ActiveTrackingDetails>;
  return (
    typeof candidate.jobId === 'string' &&
    Array.isArray(candidate.consentFiles) &&
    !!candidate.job &&
    typeof candidate.job === 'object'
  );
}

function parseDetails(raw: string): ActiveTrackingDetails | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isValidDetails(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Baca SEMUA job yang sedang dilacak (urutan = urutan unggahan).
 * Fallback: migrasi baca dari slot legacy single-job; entri dipindah
 * permanen ke list pada `saveActiveTrackingList` berikutnya. */
export function readActiveTrackingList(): ActiveTrackingDetails[] {
  try {
    const storedList = localStorage.getItem(ACTIVE_TRACKING_LIST_KEY);
    if (storedList) {
      const parsed: unknown = JSON.parse(storedList);
      if (Array.isArray(parsed)) {
        return parsed.filter(isValidDetails);
      }
    }
    const legacy = localStorage.getItem(ACTIVE_TRACKING_KEY);
    if (!legacy) return [];
    const legacyDetails = parseDetails(legacy);
    return legacyDetails ? [legacyDetails] : [];
  } catch {
    return [];
  }
}

/** Simpan seluruh list (single source of truth) + bersihkan slot legacy. */
export function saveActiveTrackingList(list: ActiveTrackingDetails[]): void {
  try {
    if (list.length === 0) {
      localStorage.removeItem(ACTIVE_TRACKING_LIST_KEY);
    } else {
      localStorage.setItem(ACTIVE_TRACKING_LIST_KEY, JSON.stringify(list));
    }
    localStorage.removeItem(ACTIVE_TRACKING_KEY);
  } catch {
    // Storage penuh / privacy mode — UI tetap jalan dengan state in-memory.
  }
}

/** Hapus satu entri job (selesai / dibatalkan). */
export function removeActiveTrackingEntry(jobId: string): void {
  saveActiveTrackingList(readActiveTrackingList().filter((d) => d.jobId !== jobId));
}

/** Bersihkan SEMUA tracking (full reset, termasuk slot legacy). */
export function clearActiveTrackingDetails(): void {
  try {
    localStorage.removeItem(ACTIVE_TRACKING_LIST_KEY);
    localStorage.removeItem(ACTIVE_TRACKING_KEY);
  } catch {
    // no-op
  }
}