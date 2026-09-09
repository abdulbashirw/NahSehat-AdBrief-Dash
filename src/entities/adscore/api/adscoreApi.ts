/**
 * AdScore RTK Query API — mirrors the ManageCare/monitoringApi pattern.
 *
 * Fetches data from POST /api/v3/adScore via the AdBrief base URL.
 * Body and response shape are still in development, so we use flexible
 * interfaces with `[key: string]: unknown` for forward-compatibility.
 */
import { api, API_URLS } from '@/shared/store/api';

/* ─── Response Types ─── */

export interface AdScoreHeader {
  ProviderID?: string;
  ProviderName?: string;
  ProviderType?: string;
  City?: string;
  MemberName?: string;
  MemberID?: string;
  CorporateName?: string;
  CorporateID?: string;
  Score?: number;
  ScoreLabel?: string;
  [key: string]: unknown;
}

export interface AdScoreItem {
  header: AdScoreHeader;
  [key: string]: unknown;
}

export interface AdScoreResponse {
  data: AdScoreItem[];
  code?: number;
  success?: boolean;
}

/** Payload for the AdScore endpoint (structure in development). */
export interface AdScorePayload {
  [key: string]: unknown;
}

/* ─── RTK Query Endpoint ─── */

export const adscoreApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getAdScore: builder.query<AdScoreResponse, AdScorePayload>({
      async queryFn(arg, _queryApi, _extraOptions, fetchWithBQ) {
        const result = await fetchWithBQ({
          url: `${API_URLS.adbrief}/adScore`,
          method: 'POST',
          body: arg,
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
      providesTags: ['AdScore'],
    }),
  }),
});

export const { useGetAdScoreQuery } = adscoreApi;
