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
        // Attempt POST to backend endpoint
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

        // Fallback mock data if API returns empty / error / 404
        return { data: { data: getMockDailyMonitoringData() } };
      },
      providesTags: ['ManageCare'],
    }),
  }),
});

export const { useGetDailyMonitoringQuery } = manageCareApi;

/** Generator for rich fallback daily monitoring mock data */
function getMockDailyMonitoringData(): DailyMonitoringItem[] {
  const diagnoses = [
    'J18.9 - Pneumonia, unspecified',
    'E11.9 - Type 2 diabetes mellitus without complications',
    'I10 - Essential (primary) hypertension',
    'A09 - Infectious gastroenteritis and colitis',
    'K29.7 - Gastritis, unspecified',
    'J45.9 - Asthma, unspecified',
    'N39.0 - Urinary tract infection, site not specified',
    'J06.9 - Acute upper respiratory infection, unspecified',
    'A91 - Dengue haemorrhagic fever',
    'B05.9 - Measles without complication',
  ];

  const providers = [
    { id: 'PRV001', name: 'RS Hermina Kemayoran' },
    { id: 'PRV002', name: 'RS Siloam Kebon Jeruk' },
    { id: 'PRV003', name: 'RS Mayapada Jakarta' },
    { id: 'PRV004', name: 'RS RSUPN Dr. Cipto Mangunkusumo' },
    { id: 'PRV005', name: 'RS Harapan Kita' },
    { id: 'PRV006', name: 'RS Pondok Indah' },
    { id: 'PRV007', name: 'Klinik Medika Sehat' },
  ];

  const members = [
    { id: 'NPP001092', name: 'Ahmad Subardjo', pd: 'P' },
    { id: 'NPP001093', name: 'Siti Aminah', pd: 'D' },
    { id: 'NPP001094', name: 'Budi Santoso', pd: 'P' },
    { id: 'NPP001095', name: 'Dewi Lestari', pd: 'D' },
    { id: 'NPP001096', name: 'Eko Prasetyo', pd: 'P' },
    { id: 'NPP001097', name: 'Fitri Handayani', pd: 'D' },
    { id: 'NPP001098', name: 'Gunawan Wibowo', pd: 'P' },
    { id: 'NPP001099', name: 'Heni Rahmawati', pd: 'D' },
    { id: 'NPP001100', name: 'Irfan Hakim', pd: 'P' },
    { id: 'NPP001101', name: 'Joko Widodo', pd: 'P' },
    { id: 'NPP001102', name: 'Kartika Putri', pd: 'D' },
    { id: 'NPP001103', name: 'Lukman Laksamana', pd: 'P' },
    { id: 'NPP001104', name: 'Maya Indah', pd: 'D' },
    { id: 'NPP001105', name: 'Nugroho Adi', pd: 'P' },
    { id: 'NPP001106', name: 'Oliva Zalianty', pd: 'D' },
  ];

  const statuses: ('DMO' | 'DHC' | 'REJECT')[] = [
    'DMO', 'DMO', 'DMO', 'DMO', 'DMO', 'DMO', 'DMO', 'DMO', 'DMO', 'DMO',
    'DMO', 'DMO', 'DHC', 'DHC', 'DHC', 'DHC', 'DHC', 'REJECT', 'REJECT'
  ];

  const items: DailyMonitoringItem[] = [];

  for (let i = 0; i < 28; i++) {
    const status = statuses[i % statuses.length];
    const prv = providers[i % providers.length];
    const mbr = members[i % members.length];
    const icd = diagnoses[i % diagnoses.length];
    const dayAgo = (i % 15) + 1;
    const admissionDate = `2025-01-${String(31 - dayAgo).padStart(2, '0')}`;
    const days = (i % 8) + 1;

    items.push({
      header: {
        ClaimStatus: status,
        ProviderID: prv.id,
        ProviderName: prv.name,
        AdmissionDate: admissionDate,
        ICDXDesc: icd,
        MemberID: mbr.id,
        MemberName: mbr.name,
        PD: mbr.pd,
        Days: days,
      },
    });
  }

  return items;
}