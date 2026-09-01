/**
 * Period Filter Store — global state for the Indemnity period filter.
 *
 * Shared across all 4 Indemnity pages (Overview, Claims Map, Demographics, Diseases).
 * Uses a simple pub/sub pattern with useSyncExternalStore for React integration.
 *
 * Concept: "per Date Now" — a single date picker defaulting to today.
 * No period type selection; the filter always uses the selected day.
 *
 * Request body format (ddmmyyyy):
 *   { start_date: "17012025", end_date: "17012025", payor_code: "AIAF" }
 */

export interface PeriodFilterState {
  /** Selected day — stored as YYYY-MM-DD, defaults to today */
  selectedDay: string;
  /** Selected payor ID — filters claims by PAYORID. 'ALL' = no filter */
  selectedPayorId: string;
}

// ── Helpers ──────────────────────────────────────────────────────

/** Get default YYYY-MM-DD string — defaults to today */
function defaultDayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// ── Store ────────────────────────────────────────────────────────

const initialState: PeriodFilterState = {
  selectedDay: defaultDayStr(),
  selectedPayorId: 'ALL',
};

let state = { ...initialState };
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): PeriodFilterState {
  return state;
}

export function getServerSnapshot(): PeriodFilterState {
  return initialState;
}

// ── Actions ──────────────────────────────────────────────────────

export function setSelectedDay(day: string): void {
  state = { ...state, selectedDay: day };
  emitChange();
}

export function setSelectedPayorId(payorId: string): void {
  state = { ...state, selectedPayorId: payorId };
  emitChange();
}

// ── Computed helpers ─────────────────────────────────────────────

/** Get the start and end dates for the current filter state (as Date objects).
 *  Always returns the same date for both (single-day filter). */
export function getDateRange(filter: PeriodFilterState): { startDate: Date; endDate: Date } {
  const d = filter.selectedDay ? new Date(filter.selectedDay) : new Date();
  return { startDate: d, endDate: d };
}