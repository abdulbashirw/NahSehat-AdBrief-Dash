/**
 * Dashboard API service — RTK Query endpoints for dashboard data.
 */
import { api } from '@/shared/store/api';

export interface DashboardKpi {
  totalClaims: number;
  totalIncurred: number;
  totalApproved: number;
  totalMembers: number;
  totalProviders: number;
  claimGrowthRate: number;
  approvalRate: number;
}

export const dashboardApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardKpi: builder.query<DashboardKpi, void>({
      query: () => '/dashboard/kpi',
      providesTags: ['Indemnity'],
    }),
  }),
});

export const { useGetDashboardKpiQuery } = dashboardApi;