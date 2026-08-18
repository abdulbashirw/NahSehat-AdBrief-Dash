/**
 * Indemnity API service — RTK Query endpoints for AdmDailyClaim data.
 *
 * The /AdmDailyClaim endpoint accepts POST with { start_date, end_date, payor_code }
 * and returns raw entries which are transformed client-side into ClaimsApiResponse.
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
/*  ICD-10 group derivation (preserved from original)                  */
/* ------------------------------------------------------------------ */

function icd10Group(code: string): string {
  const c = code.toUpperCase().slice(0, 3);
  const ch = c[0];
  const n = parseInt(c.slice(1), 10);
  if (Number.isNaN(n)) return 'Other';

  switch (ch) {
    case 'A':
      if (n <= 9) return 'Intestinal infectious diseases';
      if (n >= 15 && n <= 19) return 'Tuberculosis';
      if (n >= 20 && n <= 28) return 'Certain zoonotic bacterial diseases';
      if (n >= 30 && n <= 49) return 'Other bacterial diseases';
      if (n >= 50 && n <= 64) return 'Infections with a predominantly sexual mode of transmission';
      if (n >= 65 && n <= 69) return 'Other spirochetal diseases';
      if (n >= 70 && n <= 74) return 'Other diseases caused by chlamydiae';
      if (n >= 75 && n <= 79) return 'Rickettsioses';
      if (n >= 80 && n <= 89) return 'Arthropod-borne viral fevers';
      if (n >= 90 && n <= 99) return 'Viral infections characterized by skin and mucous membrane lesions';
      return 'Other infectious diseases';
    case 'B':
      if (n <= 9) return 'Viral infections characterized by skin and mucous membrane lesions';
      if (n >= 10 && n <= 14) return 'Other viral diseases';
      if (n >= 15 && n <= 19) return 'Viral hepatitis';
      if (n >= 20 && n <= 29) return 'HIV disease';
      if (n >= 30 && n <= 49) return 'Other viral diseases';
      if (n >= 50 && n <= 64) return 'Mycoses';
      if (n >= 65 && n <= 83) return 'Protozoal diseases';
      if (n >= 85 && n <= 89) return 'Helminthiases';
      if (n >= 90 && n <= 94) return 'Pediculosis, acariasis and other infestations';
      if (n >= 95) return 'Sequelae of infectious and parasitic diseases';
      return 'Other infectious diseases';
    case 'C': return 'Neoplasms';
    case 'D':
      if (n <= 49) return 'Neoplasms';
      if (n >= 50 && n <= 53) return 'Nutritional anaemias';
      if (n >= 55 && n <= 59) return 'Other anaemias';
      if (n >= 60 && n <= 64) return 'Coagulation defects, purpura and other haemorrhagic conditions';
      if (n >= 70 && n <= 77) return 'Other disorders of blood and blood-forming organs';
      return 'Other disorders involving the immune mechanism';
    case 'E':
      if (n <= 7) return 'Disorders of thyroid gland';
      if (n >= 8 && n <= 13) return 'Diabetes mellitus';
      if (n >= 15 && n <= 16) return 'Other disorders of glucose regulation and pancreatic internal secretion';
      if (n >= 20 && n <= 46) return 'Malnutrition and other nutritional deficiencies';
      if (n >= 50 && n <= 64) return 'Metabolic disorders';
      if (n >= 65 && n <= 88) return 'Metabolic disorders';
      return 'Metabolic disorders';
    case 'F':
      if (n >= 1 && n <= 9) return 'Organic, including symptomatic, mental disorders';
      if (n >= 10 && n <= 19) return 'Mental and behavioural disorders due to psychoactive substance use';
      if (n >= 20 && n <= 29) return 'Schizophrenia, schizotypal and delusional disorders';
      if (n >= 30 && n <= 39) return 'Mood [affective] disorders';
      if (n >= 40 && n <= 48) return 'Neurotic, stress-related and somatoform disorders';
      if (n >= 50 && n <= 59) return 'Behavioural syndromes associated with physiological disturbances';
      if (n >= 60 && n <= 69) return 'Disorders of adult personality and behaviour';
      if (n >= 70 && n <= 79) return 'Mental retardation';
      if (n >= 80 && n <= 89) return 'Disorders of psychological development';
      if (n >= 90 && n <= 98) return 'Behavioural and emotional disorders with onset usually occurring in childhood';
      return 'Other mental disorders';
    case 'G':
      if (n <= 9) return 'Inflammatory diseases of the central nervous system';
      if (n >= 10 && n <= 14) return 'Systemic atrophies primarily affecting the central nervous system';
      if (n >= 20 && n <= 26) return 'Extrapyramidal and movement disorders';
      if (n >= 30 && n <= 32) return 'Other degenerative diseases of the nervous system';
      if (n >= 35 && n <= 37) return 'Demyelinating diseases of the central nervous system';
      if (n >= 40 && n <= 47) return 'Episodic and paroxysmal disorders';
      if (n >= 50 && n <= 54) return 'Nerve, nerve root and plexus disorders';
      if (n >= 55 && n <= 59) return 'Polyneuropathies and other disorders of the peripheral nervous system';
      if (n >= 60 && n <= 65) return 'Diseases of myoneural junction and muscle';
      if (n >= 70 && n <= 73) return 'Cerebral palsy and other paralytic syndromes';
      if (n >= 80 && n <= 83) return 'Other disorders of the nervous system';
      return 'Other disorders of the nervous system';
    case 'H':
      if (n <= 2) return 'Disorders of eyelid, lacrimal system and orbit';
      if (n >= 5 && n <= 9) return 'Disorders of eyeball';
      if (n >= 10 && n <= 13) return 'Disorders of conjunctiva';
      if (n >= 15 && n <= 22) return 'Disorders of sclera, cornea, iris and ciliary body';
      if (n >= 25 && n <= 28) return 'Disorders of lens';
      if (n >= 30 && n <= 36) return 'Disorders of choroid and retina';
      if (n >= 40 && n <= 42) return 'Glaucoma';
      if (n >= 43 && n <= 45) return 'Disorders of vitreous body and globe';
      if (n >= 46 && n <= 48) return 'Disorders of optic nerve and visual pathways';
      if (n >= 49 && n <= 54) return 'Disorders of ocular muscles, binocular movement, accommodation and refraction';
      if (n >= 55 && n <= 59) return 'Visual disturbances and blindness';
      if (n >= 60 && n <= 62) return 'Disorders of external ear';
      if (n >= 65 && n <= 75) return 'Diseases of middle ear and mastoid';
      if (n >= 80 && n <= 83) return 'Other disorders of ear';
      if (n >= 90 && n <= 95) return 'Other disorders of ear';
      return 'Other disorders of eye and ear';
    case 'I':
      if (n <= 2) return 'Acute rheumatic fever';
      if (n >= 5 && n <= 9) return 'Chronic rheumatic heart diseases';
      if (n >= 10 && n <= 15) return 'Hypertensive diseases';
      if (n >= 20 && n <= 25) return 'Ischaemic heart diseases';
      if (n >= 26 && n <= 29) return 'Pulmonary heart disease and diseases of pulmonary circulation';
      if (n >= 30 && n <= 52) return 'Other forms of heart disease';
      if (n >= 60 && n <= 69) return 'Cerebrovascular diseases';
      if (n >= 70 && n <= 79) return 'Diseases of arteries, arterioles and capillaries';
      if (n >= 80 && n <= 89) return 'Diseases of veins and lymphatic vessels';
      if (n >= 95) return 'Other and unspecified disorders of the circulatory system';
      return 'Other circulatory diseases';
    case 'J':
      if (n <= 6) return 'Acute upper respiratory infections';
      if (n >= 9 && n <= 11) return 'Influenza';
      if (n >= 12 && n <= 18) return 'Influenza and pneumonia';
      if (n >= 20 && n <= 22) return 'Other acute lower respiratory infections';
      if (n >= 30 && n <= 39) return 'Other diseases of upper respiratory tract';
      if (n >= 40 && n <= 47) return 'Chronic lower respiratory diseases';
      if (n >= 60 && n <= 70) return 'Lung diseases due to external agents';
      if (n >= 80 && n <= 84) return 'Other respiratory diseases principally affecting the interstitium';
      if (n >= 85 && n <= 86) return 'Suppurative and necrotic conditions of the lung';
      if (n >= 90 && n <= 94) return 'Other diseases of the pleura';
      if (n >= 95) return 'Other diseases of the respiratory system';
      return 'Other respiratory diseases';
    case 'K':
      if (n <= 3) return 'Diseases of hard tissues of teeth';
      if (n === 4) return 'Diseases of hard tissues of teeth';
      if (n >= 5 && n <= 6) return 'Diseases of gingiva and edentulous alveolar ridge';
      if (n >= 7 && n <= 9) return 'Other disorders of teeth';
      if (n >= 10 && n <= 14) return 'Diseases of oesophagus';
      if (n >= 20 && n <= 31) return 'Diseases of oesophagus, stomach and duodenum';
      if (n >= 35 && n <= 38) return 'Diseases of appendix';
      if (n >= 40 && n <= 46) return 'Hernia';
      if (n >= 50 && n <= 52) return 'Noninflammatory disorders of intestine';
      if (n >= 55 && n <= 64) return 'Other diseases of intestines';
      if (n >= 65 && n <= 68) return 'Diseases of anus and rectum';
      if (n >= 70 && n <= 77) return 'Diseases of liver';
      if (n >= 80 && n <= 83) return 'Disorders of gallbladder and biliary tract';
      if (n >= 85 && n <= 87) return 'Disorders of pancreas';
      return 'Other diseases of the digestive system';
    case 'L':
      if (n <= 8) return 'Infections of the skin and subcutaneous tissue';
      if (n >= 10 && n <= 14) return 'Dermatitis and papulosquamous disorders';
      if (n >= 20 && n <= 30) return 'Dermatitis and eczema';
      if (n >= 40 && n <= 49) return 'Urticaria and erythema';
      if (n >= 50 && n <= 54) return 'Urticaria and erythema';
      if (n >= 55 && n <= 59) return 'Disorders of skin appendages';
      if (n >= 60 && n <= 75) return 'Other disorders of skin';
      if (n >= 80 && n <= 99) return 'Other disorders of skin and subcutaneous tissue';
      return 'Other skin disorders';
    case 'M':
      if (n <= 25) return 'Arthropathies';
      if (n >= 30 && n <= 36) return 'Systemic connective tissue disorders';
      if (n >= 40 && n <= 54) return 'Dorsopathies';
      if (n >= 60 && n <= 79) return 'Soft tissue disorders';
      if (n >= 80 && n <= 89) return 'Disorders of synovium and tendon';
      if (n >= 90 && n <= 94) return 'Osteopathies and chondropathies';
      return 'Other disorders of the musculoskeletal system and connective tissue';
    case 'N':
      if (n <= 8) return 'Glomerular diseases';
      if (n >= 10 && n <= 16) return 'Renal tubulo-interstitial diseases';
      if (n >= 18 && n <= 19) return 'Renal failure';
      if (n >= 20 && n <= 23) return 'Urolithiasis';
      if (n >= 25 && n <= 28) return 'Other disorders of kidney and ureter';
      if (n >= 30 && n <= 39) return 'Other diseases of the urinary system';
      if (n >= 40 && n <= 51) return 'Diseases of male genital organs';
      if (n >= 60 && n <= 64) return 'Disorders of breast';
      if (n >= 70 && n <= 77) return 'Inflammatory diseases of female pelvic organs';
      if (n >= 80 && n <= 84) return 'Noninflammatory disorders of female genital tract';
      if (n >= 85 && n <= 89) return 'Other disorders of female genital tract';
      return 'Other genitourinary disorders';
    case 'O':
      if (n <= 8) return 'Pregnancy with abortive outcome';
      if (n >= 10 && n <= 16) return 'Other maternal disorders predominantly related to pregnancy';
      if (n >= 20 && n <= 29) return 'Maternal care related to fetus and amniotic cavity';
      if (n >= 30 && n <= 39) return 'Antenatal screening and supervision';
      if (n >= 40 && n <= 46) return 'Complications of labour and delivery';
      if (n >= 60 && n <= 69) return 'Complications predominantly related to the puerperium';
      if (n >= 70 && n <= 75) return 'Other obstetric conditions';
      if (n >= 80 && n <= 84) return 'Encounter for delivery';
      if (n >= 85 && n <= 92) return 'Outcome of delivery';
      return 'Other pregnancy-related conditions';
    case 'R':
      if (n <= 9) return 'Symptoms involving respiratory system';
      if (n >= 10 && n <= 19) return 'Symptoms involving digestive system';
      if (n >= 20 && n <= 23) return 'Symptoms involving skin and subcutaneous tissue';
      if (n >= 40 && n <= 46) return 'Symptoms involving cognition, perception, emotional state';
      if (n >= 47 && n <= 49) return 'Symptoms involving speech and voice';
      if (n >= 50 && n <= 69) return 'General symptoms and signs';
      if (n >= 70 && n <= 79) return 'Abnormal findings on examination of blood';
      if (n >= 80 && n <= 82) return 'Abnormal findings on examination of urine';
      if (n >= 83 && n <= 89) return 'Abnormal findings on examination of other body fluids';
      if (n >= 90 && n <= 94) return 'Abnormal findings on diagnostic imaging';
      return 'Other symptoms and signs';
    case 'S':
    case 'T':
      return 'Injury and poisoning';
    case 'Z':
      if (n <= 13) return 'General examination';
      if (n >= 20 && n <= 29) return 'Reproductive health counselling';
      if (n >= 30 && n <= 39) return 'Antenatal screening and supervision';
      if (n >= 40 && n <= 53) return 'Encounters for other specific health care';
      if (n >= 55 && n <= 65) return 'Encounters for other specific health care';
      if (n >= 70 && n <= 76) return 'Factors influencing health status and contact with health services';
      return 'Factors influencing health status';
    default:
      return 'Other';
  }
}

/* ------------------------------------------------------------------ */
/*  Transformation helpers                                             */
/* ------------------------------------------------------------------ */

const num = (v: string | number | undefined): number => {
  if (v === undefined || v === null) return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};

function inferProviderType(name: string): string {
  const lower = name.toLowerCase();
  if (/\brs\b|\brumah\s*sakit/i.test(lower)) return 'RS';
  if (/klinik\s*gigi/i.test(lower)) return 'Klinik Gigi';
  if (/laboratorium|lab\s+/i.test(lower)) return 'Lab';
  if (/apotek|pharmacy/i.test(lower)) return 'Apotek';
  if (/klinik/i.test(lower)) return 'Klinik';
  return 'Klinik';
}

function approximateBirthDate(ageStr: string): string {
  const age = parseInt(ageStr, 10);
  if (Number.isNaN(age) || age < 0) return '01011900';
  const birthYear = 2026 - age;
  return `0107${birthYear}`;
}

/* ------------------------------------------------------------------ */
/*  Transform raw DCSehat entries → ClaimsApiResponse                  */
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

    if (providerId && !providerMap.has(providerId)) {
      const coords = (h.COORDINATES ?? '').split(',');
      const lat = parseFloat(coords[0]) || 0;
      const lng = parseFloat(coords[1]) || 0;
      providerMap.set(providerId, {
        PROVIDERID: providerId,
        providerName: providerName,
        type: inferProviderType(providerName),
        city: str(h.CITY),
        province: str(h.STATE),
        lat,
        lng,
        inNetwork: true,
      });
    }

    if (memberNo && !memberMap.has(memberNo)) {
      const parsedAge = parseInt(h.AGE ?? '', 10);
      memberMap.set(memberNo, {
        MEMBERNO: memberNo,
        name: str(h.NAME),
        gender: str(h.GENDER) || 'M',
        birthDate: approximateBirthDate(h.AGE ?? ''),
        relationship: str(h.RELATIONSHIP) || 'PRINCIPLE',
        joinDate: '',
        active: true,
        age: Number.isNaN(parsedAge) ? undefined : parsedAge,
      });
    }

    if (h.FDIAGNOSIS && !icd10Map.has(h.FDIAGNOSIS)) {
      icd10Map.set(h.FDIAGNOSIS, {
        code: h.FDIAGNOSIS,
        description: str(h.FDIAGNOSISDESC) || h.FDIAGNOSIS,
        group: icd10Group(h.FDIAGNOSIS),
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