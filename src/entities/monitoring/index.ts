/**
 * Monitoring entity — public API (ManageCare domain).
 */
export { manageCareApi, useGetDailyMonitoringQuery } from './api/monitoringApi';
export type { DailyMonitoringHeader, DailyMonitoringItem, DailyMonitoringResponse, DailyMonitoringPayload } from './api/monitoringApi';