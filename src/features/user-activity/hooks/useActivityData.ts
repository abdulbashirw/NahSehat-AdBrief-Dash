/**
 * useActivityData — aggregates all activity dashboard data from RTK Query.
 *
 * Fetches KPI summary, trend, modules, heatmap, and user table in parallel.
 * Provides a `refresh` function to refetch all data.
 */
import { useCallback } from 'react';
import {
  useGetSummaryQuery,
  useGetActivityUsersQuery,
  useGetTrendQuery,
  useGetModuleStatsQuery,
  useGetHeatmapQuery,
} from '@/entities/activity';
import type { ActivityQueryParams } from '@/entities/activity';

export interface UseActivityDataParams {
  days?: number;
  page?: number;
  pageSize?: number;
  search?: string;
  status?: 'ALL' | 'ONLINE' | 'OFFLINE';
  activityLevel?: 'ALL' | 'SANGAT_AKTIF' | 'AKTIF' | 'CUKUP_AKTIF' | 'KURANG_AKTIF';
  analyticsCategory?: string;
}

export function useActivityData(params: UseActivityDataParams = {}) {
  const queryParams: ActivityQueryParams = {
    days: params.days ?? 30,
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 10,
    search: params.search ?? '',
    status: params.status ?? 'ALL',
    activityLevel: params.activityLevel ?? 'ALL',
    analyticsCategory: params.analyticsCategory ?? '',
  };

  const summary = useGetSummaryQuery({ days: params.days ?? 30 });
  const users = useGetActivityUsersQuery(queryParams);
  const trend = useGetTrendQuery({ days: params.days ?? 30 });
  const modules = useGetModuleStatsQuery({ days: params.days ?? 30 });
  const heatmap = useGetHeatmapQuery({ days: params.days ?? 30 });

  const isLoading = summary.isLoading || users.isLoading || trend.isLoading || modules.isLoading || heatmap.isLoading;
  const isError = summary.isError || users.isError || trend.isError || modules.isError || heatmap.isError;

  const refresh = useCallback(() => {
    summary.refetch();
    users.refetch();
    trend.refetch();
    modules.refetch();
    heatmap.refetch();
  }, [summary, users, trend, modules, heatmap]);

  return {
    summary: summary.data,
    users: users.data,
    trend: trend.data?.data,
    modules: modules.data?.data,
    heatmap: heatmap.data?.data,
    isLoading,
    isError,
    refresh,
    // Expose individual refetch + loading for the user table (paginated)
    usersState: users,
  };
}