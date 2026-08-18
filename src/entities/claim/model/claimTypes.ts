/**
 * Indemnity module types — re-exported from shared types.
 *
 * These types define the shape of the DCSehat claims data consumed by
 * all Indemnity views (Overview, Claims Map, Demographics, Diseases).
 */

// Re-export all claim-related types from the shared types
export type {
  Claim,
  ClaimDetail,
  Provider,
  Member,
  Icd10,
  ClaimsApiResponse,
} from '@/shared/types';

export { COVERAGE_IDS, PAYOR_NAMES } from '@/shared/types';