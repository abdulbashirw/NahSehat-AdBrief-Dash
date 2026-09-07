/**
 * Monitoring entity — public API (ManageCare domain).
 */
export { manageCareApi, useGetDailyMonitoringQuery } from './api/monitoringApi';
export type { DailyMonitoringHeader, DailyMonitoringItem, DailyMonitoringResponse, DailyMonitoringPayload } from './api/monitoringApi';

// Aggregation helpers (pure functions)
export {
  kpiSummary,
  byDiagnosis,
  claimStatusSplit,
  dmoPatients,
} from './lib/aggregate';
export type {
  MonitoringKpiSummary,
  DiagnosisTrendRow,
  ClaimStatusSplit,
  PatientRow,
} from './lib/aggregate';