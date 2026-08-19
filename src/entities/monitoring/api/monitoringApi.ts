import { api, API_URLS } from '@/shared/store/api';

export interface DailyMonitoringHeader {
  ClaimStatus: 'DMO' | 'DHC' | 'REJECT' | string;
  ProviderID?: string;
  ProviderName?: string;
  AdmissionDate?: string;
  ICDXDesc?: string;
  MemberID?: string;
  MemberName?: string;
  PD?: 'P' | 'D' | string;
  Days?: number;
  [key: string]: unknown;
}

export interface DailyMonitoringItem {
  header: DailyMonitoringHeader;
  [key: string]: unknown;
}

export interface DailyMonitoringResponse {
  data: DailyMonitoringItem[];
  code?: number;
  success?: boolean;
}

/** Payload for the daily monitoring endpoint. */
export interface DailyMonitoringPayload {
  payor_code: string;
  start_date: string;
  end_date: string;
}

export const manageCareApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getDailyMonitoring: builder.query<DailyMonitoringResponse, DailyMonitoringPayload>({
      async queryFn(arg, _queryApi, _extraOptions, fetchWithBQ) {
        const result = await fetchWithBQ({
          url: `${API_URLS.adbrief}/dailyMonitoring`,
          method: 'POST',
          body: {
            payor_code: arg.payor_code,
            start_date: arg.start_date,
            end_date: arg.end_date,
          },
        });

        if (result.data) {
          const res = result.data as any;
          if (Array.isArray(res.data) && res.data.length > 0) {
            return { data: { data: res.data } };
          }
          if (Array.isArray(res) && res.length > 0) {
            return { data: { data: res } };
          }
        }

        if (result.error) {
          return { error: result.error };
        }

        // API returned empty — return empty data array
        return { data: { data: [] } };
      },
      providesTags: ['ManageCare'],
    }),
  }),
});

export const { useGetDailyMonitoringQuery } = manageCareApi;