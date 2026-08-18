/**
 * Payor Management API — RTK Query endpoints with fallback mock data.
 *
 * All mutations attempt the real backend API first, falling back to
 * in-memory mock data when the server is unreachable.
 */
import { api, API_URLS } from '@/shared/store/api';
import type { Payor, PaginatedResponse } from '@/shared/types';
import type { CreatePayorPayload, UpdatePayorPayload, PayorQueryParams } from '../model/payorTypes';

const now = new Date().toISOString();

const MOCK_PAYORS: Payor[] = [
  {
    id: 'PAY001',
    name: 'Yakes Telkom (PT Telkom Indonesia)',
    code: 'CH0022',
    category: 'MANAGE_CARE',
    description: 'Telkom Healthcare & Medical Insurance Program',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'PAY006',
    name: 'PT AdMedika Klinik Indonesia',
    code: 'ADMEDKA',
    category: 'INDEMNITY',
    description: 'AdMedika Medical Centre — Daily Claim Monitoring',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'PAY002',
    name: 'PT Asuransi Jiwa Inhealth Indonesia',
    code: 'INH001',
    category: 'INDEMNITY',
    description: 'Mandiri Inhealth Managed Care & Indemnity Services',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'PAY003',
    name: 'PT Asuransi Alliance Utama Indonesia',
    code: 'ALLI01',
    category: 'MANAGE_CARE',
    description: 'Allianz Commercial & Group Health Protection',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'PAY004',
    name: 'PT Asuransi Prudential Life Assurance',
    code: 'PRU005',
    category: 'INDEMNITY',
    description: 'Prudential Corporate & Executive Health Insurance',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'PAY005',
    name: 'PT Asuransi Central Asia (ACA)',
    code: 'ACA009',
    category: 'INDEMNITY',
    description: 'ACA General Health & Employee Benefit Coverage',
    isActive: false,
    createdAt: now,
    updatedAt: now,
  },
];

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

        // Fallback to mock data
        let list = [...MOCK_PAYORS];
        if (params.search) {
          const q = params.search.toLowerCase();
          list = list.filter(
            (p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q),
          );
        }

        const page = params.page || 1;
        const pageSize = params.pageSize || 10;
        const total = list.length;
        const totalPages = Math.ceil(total / pageSize) || 1;
        const paginated = list.slice((page - 1) * pageSize, page * pageSize);

        return {
          data: {
            data: paginated,
            total,
            page,
            pageSize,
            totalPages,
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
        // Try real API first
        const result = await fetchWithBQ({
          url: `${API_URLS.cms}/payors`,
          method: 'POST',
          body,
        });

        if (result.data) {
          return { data: result.data as Payor };
        }

        // Only fall back to mock if the API was unreachable (network error)
        // If the API responded with an error status, propagate it
        if (result.error && 'status' in result.error && typeof result.error.status === 'number') {
          return { error: result.error };
        }

        // Fallback to mock data (network error — API unreachable)
        const newPayor: Payor = {
          id: `PAY${Date.now()}`,
          name: body.name,
          code: body.code,
          category: body.category,
          description: body.description || '',
          isActive: body.isActive ?? true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        MOCK_PAYORS.unshift(newPayor);
        return { data: newPayor };
      },
      invalidatesTags: ['Payor'],
    }),

    updatePayor: builder.mutation<Payor, { id: string; body: UpdatePayorPayload }>({
      async queryFn({ id, body }, _queryApi, _extraOptions, fetchWithBQ) {
        // Try real API first
        const result = await fetchWithBQ({
          url: `${API_URLS.cms}/payors/${id}`,
          method: 'PUT',
          body,
        });

        if (result.data) {
          return { data: result.data as Payor };
        }

        // Only fall back to mock if the API was unreachable (network error)
        if (result.error && 'status' in result.error && typeof result.error.status === 'number') {
          return { error: result.error };
        }

        // Fallback to mock data (network error — API unreachable)
        const idx = MOCK_PAYORS.findIndex((p) => p.id === id);
        if (idx !== -1) {
          MOCK_PAYORS[idx] = {
            ...MOCK_PAYORS[idx],
            name: body.name ?? MOCK_PAYORS[idx].name,
            code: body.code ?? MOCK_PAYORS[idx].code,
            category: body.category ?? MOCK_PAYORS[idx].category,
            description: body.description ?? MOCK_PAYORS[idx].description,
            isActive: body.isActive ?? MOCK_PAYORS[idx].isActive,
            updatedAt: new Date().toISOString(),
          };
          return { data: MOCK_PAYORS[idx] };
        }
        return { error: { status: 404, data: 'Payor not found' } };
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Payor', id }, 'Payor'],
    }),

    deletePayor: builder.mutation<void, string>({
      async queryFn(id, _queryApi, _extraOptions, fetchWithBQ) {
        // Try real API first
        const result = await fetchWithBQ({
          url: `${API_URLS.cms}/payors/${id}`,
          method: 'DELETE',
        });

        if (result.data || !result.error) {
          return { data: undefined };
        }

        // Only fall back to mock if the API was unreachable (network error)
        // If the API responded with an error status, propagate it
        if (result.error && 'status' in result.error && typeof result.error.status === 'number') {
          return { error: result.error };
        }

        // Fallback to mock data (network error — API unreachable)
        const idx = MOCK_PAYORS.findIndex((p) => p.id === id);
        if (idx !== -1) {
          MOCK_PAYORS.splice(idx, 1);
        }
        return { data: undefined };
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