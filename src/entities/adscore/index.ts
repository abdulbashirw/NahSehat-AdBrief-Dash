/**
 * AdScore entity — public API.
 */
export {
  adscoreApi,
  useGetAdScoreQuery,
} from './api/adscoreApi';

export type {
  AdScoreHeader,
  AdScoreItem,
  AdScoreResponse,
  AdScorePayload,
} from './api/adscoreApi';

export type {
  ScoreLevel,
  ScoreRange,
  ProviderType,
  ProviderSearchParams,
  MemberSearchParams,
  CorporateSearchParams,
  SearchTab,
} from './model/adscoreTypes';

export {
  SCORE_RANGES,
  SCORE_COLORS,
  SCORE_LABELS,
  PROVIDER_TYPES,
} from './model/adscoreTypes';

export {
  computeScoreLevel,
  getScoreRange,
  buildScoreBreakdown,
  generateDemoScore,
} from './lib/aggregate';

export type { ScoreBreakdown } from './lib/aggregate';
