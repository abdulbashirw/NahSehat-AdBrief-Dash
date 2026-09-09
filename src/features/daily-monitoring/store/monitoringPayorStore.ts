/**
 * Monitoring Payor Store — global state for the Daily Monitoring payor selector.
 *
 * Mirrors the `periodFilterStore` pattern from Indemnity, but simpler:
 * Daily Monitoring uses a fixed 30-day date range (no user-selectable date),
 * so this store only holds the selected payor ID.
 *
 * Shared state via a simple pub/sub pattern with useSyncExternalStore.
 */
export interface MonitoringPayorState {
  /** Selected payor ID — filters monitoring data by payor. 'ALL' = not yet selected */
  selectedPayorId: string;
}

// ── Store ────────────────────────────────────────────────────────

const initialState: MonitoringPayorState = {
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

export function getSnapshot(): MonitoringPayorState {
  return state;
}

export function getServerSnapshot(): MonitoringPayorState {
  return initialState;
}

// ── Actions ──────────────────────────────────────────────────────

export function setSelectedPayorId(payorId: string): void {
  state = { ...state, selectedPayorId: payorId };
  emitChange();
}