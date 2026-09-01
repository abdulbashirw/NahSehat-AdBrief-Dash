/**
 * Auto-Rotate Tabs Store — client-side preference for automatic tab rotation.
 *
 * Persisted in localStorage so each user's preference survives page reloads.
 * Uses the same pub/sub + useSyncExternalStore pattern as periodFilterStore.
 *
 * State shape: { enabled, intervalSeconds }
 *   - enabled:          whether auto-rotation is active (default: true)
 *   - intervalSeconds:  seconds between tab switches (default: 150 = 2.5 min)
 *
 * Backward-compatible with the old storage format (plain "true"/"false" string).
 */
const STORAGE_KEY = 'nahsehat.autoRotateTabs';

/** 2 minutes 30 seconds, in seconds. */
export const DEFAULT_INTERVAL_SECONDS = 150;

/** Minimum allowed interval (10 seconds) — prevents timer thrashing. */
export const MIN_INTERVAL_SECONDS = 10;

/** Maximum allowed interval (30 minutes) — sanity ceiling. */
export const MAX_INTERVAL_SECONDS = 30 * 60;

export type AutoRotateState = {
  enabled: boolean;
  intervalSeconds: number;
};

const DEFAULT_STATE: AutoRotateState = {
  enabled: true,
  intervalSeconds: DEFAULT_INTERVAL_SECONDS,
};

let state: AutoRotateState = readFromStorage();
const listeners = new Set<() => void>();

function readFromStorage(): AutoRotateState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return { ...DEFAULT_STATE };

    // Migrate old format (plain "true"/"false" string — no interval stored).
    if (stored === 'true' || stored === 'false') {
      return { enabled: stored === 'true', intervalSeconds: DEFAULT_STATE.intervalSeconds };
    }

    const parsed = JSON.parse(stored);
    return {
      enabled:
        typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_STATE.enabled,
      intervalSeconds:
        typeof parsed.intervalSeconds === 'number' && parsed.intervalSeconds > 0
          ? clampInterval(parsed.intervalSeconds)
          : DEFAULT_STATE.intervalSeconds,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function clampInterval(seconds: number): number {
  return Math.min(MAX_INTERVAL_SECONDS, Math.max(MIN_INTERVAL_SECONDS, Math.round(seconds)));
}

function emitChange(): void {
  listeners.forEach((l) => l());
}

// ── External store API (for useSyncExternalStore) ──────────────────

export function subscribeAutoRotate(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAutoRotateSnapshot(): AutoRotateState {
  return state;
}

export function getAutoRotateServerSnapshot(): AutoRotateState {
  return DEFAULT_STATE;
}

// ── Actions ────────────────────────────────────────────────────────

export function setAutoRotateEnabled(value: boolean): void {
  state = { ...state, enabled: value };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage might be unavailable (private mode, etc.) — keep in-memory only.
  }
  emitChange();
}

export function setAutoRotateInterval(seconds: number): void {
  state = { ...state, intervalSeconds: clampInterval(seconds) };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage might be unavailable (private mode, etc.) — keep in-memory only.
  }
  emitChange();
}