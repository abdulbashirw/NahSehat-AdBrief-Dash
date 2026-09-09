/**
 * Activity API — RTK Query endpoints for the User Activity dashboard.
 *
 * 8 endpoints:
 *   getSummary    — 6 KPI metrics
 *   getUsers      — detailed user table (paginated, search, filter)
 *   getTrend      — daily trend chart data
 *   getModules    — module distribution donut chart
 *   getHeatmap    — hourly heatmap data
 *   getLogs       — raw access logs (paginated)
 *   getSessions   — login sessions (paginated)
 *   triggerAggregate — POST to trigger daily aggregation
 */
import { api, API_URLS } from '@/shared/store/api';
import type { PaginatedResponse } from '@/shared/types';
import type {
  ActivitySummary,
  DetailedUserRow,
  TrendPoint,
  ModuleStat,
  HeatmapCell,
  AccessLogRow,
  LoginSessionRow,
  ActivityQueryParams,
} from '../model/activityTypes';

export const activityApi = api.injectEndpoints({
  endpoints: (builder) => ({
    /* ── 1. KPI Summary ── */
    getSummary: builder.query<ActivitySummary, { days?: number }>({
      query: ({ days = 30 } = {}) => ({
        url: `${API_URLS.cms}/activity/summary`,
        params: { days },
      }),
      providesTags: ['Activity'],
    }),

    /* ── 2. Detailed User Table ── */
    getActivityUsers: builder.query<PaginatedResponse<DetailedUserRow>, ActivityQueryParams>({
      query: (params) => ({
        url: `${API_URLS.cms}/activity/users`,
        params: {
          days: params.days ?? 30,
          page: params.page ?? 1,
          pageSize: params.pageSize ?? 10,
          search: params.search ?? '',
          status: params.status ?? 'ALL',
          activityLevel: params.activityLevel ?? 'ALL',
          analyticsCategory: params.analyticsCategory ?? '',
        },
      }),
      providesTags: ['Activity'],
    }),

    /* ── 3. Daily Trend ── */
    getTrend: builder.query<{ data: TrendPoint[] }, { days?: number }>({
      query: ({ days = 30 } = {}) => ({
        url: `${API_URLS.cms}/activity/trend`,
        params: { days },
      }),
      providesTags: ['Activity'],
    }),

    /* ── 4. Module Distribution ── */
    getModuleStats: builder.query<{ data: ModuleStat[] }, { days?: number }>({
      query: ({ days = 30 } = {}) => ({
        url: `${API_URLS.cms}/activity/modules`,
        params: { days },
      }),
      providesTags: ['Activity'],
    }),

    /* ── 5. Heatmap ── */
    getHeatmap: builder.query<{ data: HeatmapCell[] }, { days?: number }>({
      query: ({ days = 30 } = {}) => ({
        url: `${API_URLS.cms}/activity/heatmap`,
        params: { days },
      }),
      providesTags: ['Activity'],
    }),

    /* ── 6. Raw Access Logs ── */
    getAccessLogs: builder.query<PaginatedResponse<AccessLogRow>, ActivityQueryParams>({
      query: (params) => ({
        url: `${API_URLS.cms}/activity/logs`,
        params: {
          days: params.days ?? 30,
          page: params.page ?? 1,
          pageSize: params.pageSize ?? 20,
          search: params.search ?? '',
        },
      }),
      providesTags: ['Activity'],
    }),

    /* ── 7. Login Sessions ── */
    getLoginSessions: builder.query<PaginatedResponse<LoginSessionRow>, ActivityQueryParams>({
      query: (params) => ({
        url: `${API_URLS.cms}/activity/sessions`,
        params: {
          days: params.days ?? 30,
          page: params.page ?? 1,
          pageSize: params.pageSize ?? 20,
          search: params.search ?? '',
        },
      }),
      providesTags: ['Activity'],
    }),

    /* ── 8. Trigger Aggregation ── */
    triggerAggregation: builder.mutation<{ message: string; date: string }, { date?: string }>({
      query: (body) => ({
        url: `${API_URLS.cms}/activity/aggregate`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Activity'],
    }),
  }),
});

export const {
  useGetSummaryQuery,
  useGetActivityUsersQuery,
  useGetTrendQuery,
  useGetModuleStatsQuery,
  useGetHeatmapQuery,
  useGetAccessLogsQuery,
  useGetLoginSessionsQuery,
  useTriggerAggregationMutation,
} = activityApi;