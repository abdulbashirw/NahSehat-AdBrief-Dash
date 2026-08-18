/**
 * useExportEnabled — reads the `enableExport` public setting from the API.
 * Returns `true` by default while loading (fail-open: don't hide export
 * if the setting hasn't loaded yet).
 */
import { useGetPublicSettingsQuery } from '@/entities/settings/api/settingApi';

export function useExportEnabled(): boolean {
  const { data } = useGetPublicSettingsQuery(undefined, {
    // Refetch every 60s so a toggle in Settings is picked up app-wide.
    pollingInterval: 60_000,
  });
  return data?.enableExport ?? true;
}