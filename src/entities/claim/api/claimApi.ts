/**
 * Indemnity API service — RTK Query endpoints for AdmDailyClaim data.
 *
 * The /AdmDailyClaim endpoint accepts POST with { start_date, end_date, payor_code }
 * and returns raw entries which are transformed client-side into ClaimsApiResponse.
 *
 * All field values come directly from the API response structure — no client-side
 * derivation (e.g. ICD-10 group, provider type, birth date) is performed.
 */
import { api, API_URLS } from '@/shared/store/api';
import type { ClaimsApiResponse, Claim, ClaimDetail, Provider, Member, Icd10 } from '@/shared/types';

/* ------------------------------------------------------------------ */
/*  Request body for AdmDailyClaim endpoint                             */
/* ------------------------------------------------------------------ */

export interface AdmDailyClaimRequest {
  start_date: string;  // ddmmyyyy format
  end_date: string;    // ddmmyyyy format
  payor_code: string;
}

/* ------------------------------------------------------------------ */
/*  Raw API response shape — matches the backend JSON                  */
/* ------------------------------------------------------------------ */

interface DCSehatHeader {
  id: number;
  PAYORID: string;
  CLIENTID?: string;
  PROVIDERID?: string;
  CARDNO?: string;
  CLAIMNO: string;
  CLAIMTYPE?: string;
  STATUS?: string;
  POLICYNO?: string;
  EMPID?: string;
  /** API may return either BRANCHCODE or BRANCH */
  BRANCHCODE?: string;
  BRANCH?: string;
  MEMBERNO?: string;
  NAME?: string;
  GENDER?: string;
  AGE?: string;
  ADMISSIONDATE?: string;
  DISCHARGEDATE?: string;
  DURATION?: string;
  COVERAGEID?: string;
  PPLAN?: string;
  DISABILITY?: string;
  FDIAGNOSIS?: string;
  LDIAGNOSIS?: string;
  FDIAGNOSISDESC?: string;
  RELATIONSHIP?: string;
  INCURRED?: string;
  APPROVED?: string;
  UNAPPROVED?: string;
  ASOAPPROVED?: string;
  HIGHPLAN?: string;
  REMARKS?: string;
  EXCESS?: string;
  INVOICENO?: string;
  HOSPITALINVOICEDATE?: string;
  HOSPITALINVOICENO?: string;
  RECEIVEDDATE?: string;
  SUBMISSIONDATE?: string;
  VERIFIEDBY?: string;
  PAYMENTDATE?: string;
  PHYSICIANID?: string;
  PROVIDERNAME?: string;
  STATE?: string;
  CITY?: string;
  COORDINATES?: string;
  created_at?: string;
}

interface DCSehatDetail {
  CLAIMNO?: string;
  BENEFITID?: string;
  BENEFITDESC?: string;
  INCURRED?: string;
  APPROVED?: string;
  UNAPPROVED?: string;
  EXCESS?: string;
  EXCESSOS?: string;
  REFUND?: string;
  PAIDTOPROVIDER?: string;
  ASOAPPROVED?: string;
  REASONCODE?: string;
}

/** API response format: flat { HEADER, DETAIL } entries */
interface DCSehatEntry {
  HEADER: DCSehatHeader;
  DETAIL: DCSehatDetail[];
}

/* ------------------------------------------------------------------ */
/*  Transformation helpers                                             */
/* ------------------------------------------------------------------ */

const num = (v: string | number | undefined): number => {
  if (v === undefined || v === null) return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};

/* ------------------------------------------------------------------ */
/*  Transform raw DCSehat entries → ClaimsApiResponse                  */
/*                                                                      */
/*  Only fields present in the API response are populated.             */
/*  Fields not returned by the API (group, type, birthDate, joinDate)  */
/*  are set to empty string — no client-side derivation.               */
/* ------------------------------------------------------------------ */

function transformDCSehat(entries: DCSehatEntry[]): ClaimsApiResponse {
  const claims: Claim[] = [];
  const claimDetails: ClaimDetail[] = [];
  const providerMap = new Map<string, Provider>();
  const memberMap = new Map<string, Member>();
  const icd10Map = new Map<string, Icd10>();

  // Helper: safely get string with fallback
  const str = (v: string | undefined): string => v ?? '';

  for (const entry of entries) {
    const h = entry.HEADER;
    const providerName = str(h.PROVIDERNAME);
    const providerId = str(h.PROVIDERID);
    const memberNo = str(h.MEMBERNO);
    const claimNo = str(h.CLAIMNO);

    claims.push({
      id: h.id,
      PAYORID: str(h.PAYORID),
      CLIENTID: str(h.CLIENTID),
      PROVIDERID: providerId,
      CARDNO: str(h.CARDNO),
      CLAIMNO: claimNo,
      CLAIMTYPE: str(h.CLAIMTYPE),
      STATUS: str(h.STATUS),
      POLICYNO: str(h.POLICYNO),
      EMPID: str(h.EMPID),
      // API may return either BRANCHCODE or BRANCH
      BRANCH: str(h.BRANCHCODE) || str(h.BRANCH),
      MEMBERNO: memberNo,
      NAME: str(h.NAME),
      GENDER: str(h.GENDER),
      AGE: str(h.AGE),
      ADMISSIONDATE: str(h.ADMISSIONDATE),
      DISCHARGEDATE: str(h.DISCHARGEDATE),
      DURATION: str(h.DURATION),
      COVERAGEID: str(h.COVERAGEID),
      PPLAN: str(h.PPLAN),
      DISABILITY: str(h.DISABILITY),
      FDIAGNOSIS: str(h.FDIAGNOSIS),
      LDIAGNOSIS: str(h.LDIAGNOSIS),
      FDIAGNOSISDESC: str(h.FDIAGNOSISDESC),
      RELATIONSHIP: str(h.RELATIONSHIP),
      INCURRED: num(h.INCURRED),
      APPROVED: num(h.APPROVED),
      UNAPPROVED: num(h.UNAPPROVED),
      ASOAPPROVED: num(h.ASOAPPROVED),
      HIGHPLAN: str(h.HIGHPLAN),
      REMARKS: str(h.REMARKS),
      EXCESS: num(h.EXCESS),
      providerName: providerName,
      INVOICENO: str(h.INVOICENO),
      HOSPITALINVOICEDATE: str(h.HOSPITALINVOICEDATE),
      HOSPITALINVOICENO: str(h.HOSPITALINVOICENO),
      RECEIVEDDATE: str(h.RECEIVEDDATE),
      SUBMISSIONDATE: str(h.SUBMISSIONDATE),
      VERIFIEDBY: str(h.VERIFIEDBY),
      PHYSICIANID: str(h.PHYSICIANID),
      PAYMENTDATE: str(h.PAYMENTDATE),
      created_at: str(h.created_at),
    });

    for (const d of entry.DETAIL) {
      claimDetails.push({
        CLAIMNO: str(d.CLAIMNO) || claimNo,
        BENEFITID: str(d.BENEFITID),
        BENEFITDESC: str(d.BENEFITDESC),
        INCURRED: num(d.INCURRED),
        APPROVED: num(d.APPROVED),
        UNAPPROVED: num(d.UNAPPROVED),
        EXCESS: num(d.EXCESS),
        REFUND: num(d.REFUND),
        PAIDTOPROVIDER: num(d.PAIDTOPROVIDER),
      });
    }

    // Provider — only fields from API response; type not returned → empty
    if (providerId && !providerMap.has(providerId)) {
      const coords = (h.COORDINATES ?? '').split(',');
      const lat = parseFloat(coords[0]) || 0;
      const lng = parseFloat(coords[1]) || 0;
      providerMap.set(providerId, {
        PROVIDERID: providerId,
        providerName: providerName,
        type: '',               // not in API response
        city: str(h.CITY),
        province: str(h.STATE),
        lat,
        lng,
        inNetwork: true,
      });
    }

    // Member — only fields from API response; birthDate/joinDate not returned → empty
    if (memberNo && !memberMap.has(memberNo)) {
      const parsedAge = parseInt(h.AGE ?? '', 10);
      memberMap.set(memberNo, {
        MEMBERNO: memberNo,
        name: str(h.NAME),
        gender: str(h.GENDER) || 'M',
        birthDate: '',          // not in API response
        relationship: str(h.RELATIONSHIP) || 'PRINCIPLE',
        joinDate: '',           // not in API response
        active: true,
        age: Number.isNaN(parsedAge) ? undefined : parsedAge,
      });
    }

    // ICD-10 — only fields from API response; group not returned → empty
    if (h.FDIAGNOSIS && !icd10Map.has(h.FDIAGNOSIS)) {
      icd10Map.set(h.FDIAGNOSIS, {
        code: h.FDIAGNOSIS,
        description: str(h.FDIAGNOSISDESC) || h.FDIAGNOSIS,
        group: '',               // not in API response
      });
    }
  }

  return {
    claims,
    claimDetails,
    providers: [...providerMap.values()],
    members: [...memberMap.values()],
    icd10: [...icd10Map.values()],
  };
}

/* ------------------------------------------------------------------ */
/*  RTK Query endpoints                                                */
/* ------------------------------------------------------------------ */

export const indemnityApi = api.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Fetch AdmDailyClaim data via POST with date range and payor code.
     * Transforms the response client-side into ClaimsApiResponse.
     */
    getDCSehat: builder.query<ClaimsApiResponse, AdmDailyClaimRequest>({
      async queryFn(arg, _queryApi, _extraOptions, fetchWithBQ) {
        // POST to AdmDailyClaim endpoint with request body
        const result = await fetchWithBQ({
          url: `${API_URLS.adbrief}/AdmDailyClaim`,
          method: 'POST',
          body: {
            start_date: arg.start_date,
            end_date: arg.end_date,
            payor_code: arg.payor_code,
          },
        });

        // If the API request itself failed, return the error
        if (result.error) {
          return { error: result.error };
        }

        // Parse the API response
        if (result.data) {
          const resData = result.data as any;
          let apiEntries: DCSehatEntry[] | null = null;

          // New API response format: { code: 200, data: [...] }
          if (resData && Array.isArray(resData.data)) {
            apiEntries = resData.data;
          } else if (Array.isArray(resData)) {
            // Fallback: direct array response
            apiEntries = resData;
          }

          // If we have entries, transform them
          if (apiEntries && apiEntries.length > 0) {
            try {
              const transformed = transformDCSehat(apiEntries);
              return { data: transformed };
            } catch (err) {
              return { error: { status: 'CUSTOM_ERROR', error: String(err) } };
            }
          }

          // API returned empty data — return empty ClaimsApiResponse
          return { data: { claims: [], claimDetails: [], providers: [], members: [], icd10: [] } };
        }

        // Should not reach here, but just in case
        return { data: { claims: [], claimDetails: [], providers: [], members: [], icd10: [] } };
      },
      providesTags: ['Indemnity'],
    }),
  }),
});

export const { useGetDCSehatQuery } = indemnityApi;