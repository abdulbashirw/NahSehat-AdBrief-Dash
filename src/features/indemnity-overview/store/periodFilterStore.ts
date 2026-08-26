/**
 * Period Filter Store — global state for the Indemnity period filter.
 *
 * Shared across all 4 Indemnity pages (Overview, Claims Map, Demographics, Diseases).
 * Uses a simple pub/sub pattern with useSyncExternalStore for React integration.
 *
 * Period types:
 *   w1     → Week 1:  1st – 7th of month
 *   w2     → Week 2:  8th – 14th of month
 *   w3     → Week 3:  15th – 21st of month
 *   w4     → Week 4:  22nd – end of month
 *   month  → Full month: 1st – end of month
 *   custom → Free date range (start/end picked by user)
 *
 * Request body format (ddmmyyyy):
 *   { start_date: "01072025", end_date: "07072025", payor_code: "AIAF" }
 */

export type PeriodType = 'w1' | 'w2' | 'w3' | 'w4' | 'month' | 'custom';

export interface PeriodFilterState {
  periodType: PeriodType;
  /** Selected month for w1/w2/w3/w4/month — stored as YYYY-MM */
  selectedMonth: string;
  /** Custom start date (ISO format: YYYY-MM-DD) */
  customStartDate: string;
  /** Custom end date (ISO format: YYYY-MM-DD) */
  customEndDate: string;
  /** Selected payor ID — filters claims by PAYORID. 'ALL' = no filter */
  selectedPayorId: string;
}

// ── Helpers ──────────────────────────────────────────────────────

/** Locale-aware short month names — defaults to English, overridden by _setFormatLang */
let MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Update month names when language changes (called from LanguageSync) */
export function setPeriodMonthNames(names: string[]) {
  MONTHS_SHORT = names;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Convert Date to ddmmyyyy */
function toDDMMYYYY(d: Date): string {
  return `${pad2(d.getDate())}${pad2(d.getMonth() + 1)}${d.getFullYear()}`;
}

/** Generate available months dynamically — always includes current month, covers data range (Jul 2025 – Jun 2026) */
function generateAvailableMonths(): { value: string; label: string }[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-based

  // Data range: Jul 2025 – Jun 2026
  const dataStart = new Date(2025, 6, 1); // Jul 2025
  const dataEnd = new Date(2026, 5, 1);   // Jun 2026

  // Start from the earlier of data start or 12 months before current
  const start = new Date(Math.min(dataStart.getTime(), new Date(currentYear, currentMonth - 12, 1).getTime()));
  // End at the later of data end or current month
  const end = new Date(Math.max(dataEnd.getTime(), new Date(currentYear, currentMonth, 1).getTime()));

  const months: { value: string; label: string }[] = [];
  const d = new Date(start);
  while (d <= end) {
    const y = d.getFullYear();
    const m = d.getMonth();
    months.push({
      value: `${y}-${String(m + 1).padStart(2, '0')}`,
      label: `${MONTHS_SHORT[m]} ${y}`,
    });
    d.setMonth(d.getMonth() + 1);
  }
  return months;
}

const AVAILABLE_MONTHS_LIST = generateAvailableMonths();

/** Get default YYYY-MM string — defaults to current month */
function defaultMonthStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ── Store ────────────────────────────────────────────────────────

const initialState: PeriodFilterState = {
  periodType: 'month',
  selectedMonth: defaultMonthStr(),
  customStartDate: '',
  customEndDate: '',
  selectedPayorId: 'ALL',
};

let state = { ...initialState };
let listeners = new Set<() => void>();
let version = 0;

function emitChange() {
  version++;
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

export function setPeriodType(type: PeriodType): void {
  state = { ...state, periodType: type };
  emitChange();
}

export function setSelectedMonth(month: string): void {
  state = { ...state, selectedMonth: month };
  emitChange();
}

export function setCustomStartDate(date: string): void {
  state = { ...state, customStartDate: date };
  emitChange();
}

export function setCustomEndDate(date: string): void {
  state = { ...state, customEndDate: date };
  emitChange();
}

export function setFilter(params: { periodType: PeriodType; selectedMonth: string; customStartDate?: string; customEndDate?: string }): void {
  state = {
    ...state,
    periodType: params.periodType,
    selectedMonth: params.selectedMonth,
    customStartDate: params.customStartDate ?? state.customStartDate,
    customEndDate: params.customEndDate ?? state.customEndDate,
  };
  emitChange();
}

export function setSelectedPayorId(payorId: string): void {
  state = { ...state, selectedPayorId: payorId };
  emitChange();
}

// ── Computed helpers ─────────────────────────────────────────────

/** Get the start and end dates for the current filter state (as Date objects) */
export function getDateRange(filter: PeriodFilterState): { startDate: Date; endDate: Date } {
  const [year, month] = filter.selectedMonth.split('-').map(Number);
  const monthIdx = month - 1; // 0-based
  const lastDay = daysInMonth(year, monthIdx);

  if (filter.periodType === 'custom') {
    const startDate = filter.customStartDate ? new Date(filter.customStartDate) : new Date(year, monthIdx, 1);
    const endDate = filter.customEndDate ? new Date(filter.customEndDate) : new Date(year, monthIdx, lastDay);
    return { startDate, endDate };
  }

  const weekRanges: Record<string, [number, number]> = {
    w1: [1, 7],
    w2: [8, 14],
    w3: [15, 21],
    w4: [22, lastDay],
    month: [1, lastDay],
  };

  const [startDay, endDay] = weekRanges[filter.periodType] ?? weekRanges.month;
  return {
    startDate: new Date(year, monthIdx, startDay),
    endDate: new Date(year, monthIdx, endDay),
  };
}

/** Max custom range in days (1 month = 31 days inclusive) */
export const MAX_CUSTOM_RANGE_DAYS = 31;

/**
 * Validate the custom date range.
 * Rules:
 *   - Start and end dates must both be set
 *   - End date must be >= start date
 *   - Range must not exceed 31 days (inclusive)
 *
 * Returns { valid: true } when OK, or { valid: false, message } with an
 * human-readable error message.
 */
export function validateCustomRange(filter: PeriodFilterState, t?: (key: string) => string): { valid: boolean; message?: string } {
  if (filter.periodType !== 'custom') return { valid: true };

  if (!filter.customStartDate || !filter.customEndDate) {
    return { valid: false, message: t ? t('periodFilter.selectBothDates') : 'Please select both start and end dates.' };
  }

  const start = new Date(filter.customStartDate);
  const end = new Date(filter.customEndDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { valid: false, message: t ? t('periodFilter.invalidDateFormat') : 'Invalid date format.' };
  }

  // Strip time portion for accurate day diff
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) {
    return { valid: false, message: t ? t('periodFilter.endDateAfterStart') : 'End date must be on or after start date.' };
  }

  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1; // inclusive
  if (diffDays > MAX_CUSTOM_RANGE_DAYS) {
    return { valid: false, message: t ? t('periodFilter.rangeExceedsMax') : `Date range cannot exceed ${MAX_CUSTOM_RANGE_DAYS} days (1 month). Current range: ${diffDays} days.` };
  }

  return { valid: true };
}

/** Get the request body format (ddmmyyyy strings) */
export function getRequestBody(filter: PeriodFilterState, payorCode: string): { start_date: string; end_date: string; payor_code: string } {
  const { startDate, endDate } = getDateRange(filter);
  return {
    start_date: toDDMMYYYY(startDate),
    end_date: toDDMMYYYY(endDate),
    payor_code: payorCode,
  };
}

/** Get a human-readable date range label — month names are locale-aware via setPeriodMonthNames */
export function getDateRangeLabel(filter: PeriodFilterState): string {
  const { startDate, endDate } = getDateRange(filter);
  const startLabel = `${startDate.getDate()} ${MONTHS_SHORT[startDate.getMonth()]} ${startDate.getFullYear()}`;
  const endLabel = `${endDate.getDate()} ${MONTHS_SHORT[endDate.getMonth()]} ${endDate.getFullYear()}`;

  if (startLabel === endLabel) return startLabel;
  return `${startDate.getDate()} – ${endDate.getDate()} ${MONTHS_SHORT[endDate.getMonth()]} ${endDate.getFullYear()}`;
}

/** Get a short period label like "W1 · Jul 2025" or "Custom · Jul 2025" */
export function getPeriodLabel(filter: PeriodFilterState, t?: (key: string) => string): string {
  const [year, month] = filter.selectedMonth.split('-').map(Number);
  const monthIdx = month - 1;
  const monthYear = `${MONTHS_SHORT[monthIdx]} ${year}`;

  const labels: Record<string, string> = {
    w1: `${t ? t('periodFilter.w1') : 'W1'} · ${monthYear}`,
    w2: `${t ? t('periodFilter.w2') : 'W2'} · ${monthYear}`,
    w3: `${t ? t('periodFilter.w3') : 'W3'} · ${monthYear}`,
    w4: `${t ? t('periodFilter.w4') : 'W4'} · ${monthYear}`,
    month: monthYear,
    custom: t ? t('periodFilter.custom') : 'Custom',
  };

  return labels[filter.periodType] ?? monthYear;
}

/** Available months for the selector — exported for use in PeriodFilter component */
export const AVAILABLE_MONTHS = AVAILABLE_MONTHS_LIST;