/**
 * Activity entity — public API for the User Activity dashboard.
 */
export {
  activityApi,
  useGetSummaryQuery,
  useGetActivityUsersQuery,
  useGetTrendQuery,
  useGetModuleStatsQuery,
  useGetHeatmapQuery,
  useGetAccessLogsQuery,
  useGetLoginSessionsQuery,
  useTriggerAggregationMutation,
} from './api/activityApi';

export type {
  ActivitySummary,
  DetailedUserRow,
  TrendPoint,
  ModuleStat,
  HeatmapCell,
  AccessLogRow,
  LoginSessionRow,
  ActivityLevel,
  OnlineStatus,
  ActivityQueryParams,
} from './model/activityTypes';

export {
  buildKpiCards,
  computeActivityLevel,
  ACTIVITY_LEVEL_LABELS,
  ACTIVITY_LEVEL_COLORS,
  buildDonutData,
  buildTrendData,
  buildHeatmapGrid,
  buildTopUsersBar,
  DAY_LABELS,
  HOUR_LABELS,
} from './lib/aggregate';

export type { KpiCard, DonutSlice, HeatmapGrid, BarUser } from './lib/aggregate';