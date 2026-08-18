/**
 * Claim entity — public API.
 */
export type { Claim, ClaimDetail, Provider, Member, Icd10, ClaimsApiResponse } from '@/shared/types';
export { COVERAGE_IDS, PAYOR_NAMES } from '@/shared/types';
export { indemnityApi, useGetDCSehatQuery } from './api/claimApi';