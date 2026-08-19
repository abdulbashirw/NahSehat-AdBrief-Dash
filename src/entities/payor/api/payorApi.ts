/**
 * Payor Management API — RTK Query endpoints.
 *
 * All endpoints call the real backend API directly.
 */
import { api, API_URLS } from '@/shared/store/api';
import type { Payor, PaginatedResponse } from '@/shared/types';
import type { CreatePayorPayload, UpdatePayorPayload, PayorQueryParams } from '../model/payorTypes';

export const payorApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getPayors: builder.query<PaginatedResponse<Payor>, PayorQueryParams>({
      async queryFn(params, _queryApi, _extraOptions, fetchWithBQ) {
        const result = await fetchWithBQ({
          url: `${API_URLS.cms}/payors`,
          params: {
            page: params.page,
            pageSize: params.pageSize,
            search: params.search,
          },
        });

        if (result.data) {
          const res = result.data as any;
          if (res && res.data && Array.isArray(res.data)) {
            return { data: res as PaginatedResponse<Payor> };
          }
        }

        if (result.error) {
          return { error: result.error };
        }

        // API returned empty — return empty paginated response
        return {
          data: {
            data: [],
            total: 0,
            page: params.page || 1,
            pageSize: params.pageSize || 10,
            totalPages: 1,
          },
        };
      },
      providesTags: ['Payor'],
    }),

    getPayorById: builder.query<Payor, string>({
      query: (id) => `${API_URLS.cms}/payors/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Payor', id }],
    }),

    createPayor: builder.mutation<Payor, CreatePayorPayload>({
      async queryFn(body, _queryApi, _extraOptions, fetchWithBQ) {
        const result = await fetchWithBQ({
          url: `${API_URLS.cms}/payors`,
          method: 'POST',
          body,
        });

        if (result.data) {
          return { data: result.data as Payor };
        }
        return { error: result.error! };
      },
      invalidatesTags: ['Payor'],
    }),

    updatePayor: builder.mutation<Payor, { id: string; body: UpdatePayorPayload }>({
      async queryFn({ id, body }, _queryApi, _extraOptions, fetchWithBQ) {
        const result = await fetchWithBQ({
          url: `${API_URLS.cms}/payors/${id}`,
          method: 'PUT',
          body,
        });

        if (result.data) {
          return { data: result.data as Payor };
        }
        return { error: result.error! };
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Payor', id }, 'Payor'],
    }),

    deletePayor: builder.mutation<void, string>({
      async queryFn(id, _queryApi, _extraOptions, fetchWithBQ) {
        const result = await fetchWithBQ({
          url: `${API_URLS.cms}/payors/${id}`,
          method: 'DELETE',
        });

        if (result.data || !result.error) {
          return { data: undefined };
        }
        return { error: result.error };
      },
      invalidatesTags: ['Payor'],
    }),
  }),
});

export const {
  useGetPayorsQuery,
  useGetPayorByIdQuery,
  useCreatePayorMutation,
  useUpdatePayorMutation,
  useDeletePayorMutation,
} = payorApi;