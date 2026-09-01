/**
 * useAutoRotateSettings — React hook for the auto-rotate tabs preference.
 *
 * Reads from the localStorage-backed autoRotateStore via useSyncExternalStore
 * so the Settings UI and the TabLayout consumer stay in sync without
 * prop drilling or a shared context.
 *
 * @returns { enabled, intervalSeconds, setEnabled, setIntervalSeconds }
 */
import { useSyncExternalStore } from 'react';
import {
  subscribeAutoRotate,
  getAutoRotateSnapshot,
  getAutoRotateServerSnapshot,
  setAutoRotateEnabled,
  setAutoRotateInterval,
} from './autoRotateStore';

export function useAutoRotateSettings() {
  const state = useSyncExternalStore(
    subscribeAutoRotate,
    getAutoRotateSnapshot,
    getAutoRotateServerSnapshot,
  );
  return {
    enabled: state.enabled,
    intervalSeconds: state.intervalSeconds,
    setEnabled: setAutoRotateEnabled,
    setIntervalSeconds: setAutoRotateInterval,
  };
}