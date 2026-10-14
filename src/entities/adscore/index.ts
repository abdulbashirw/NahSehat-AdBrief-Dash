/**
 * AdScore entity — public API.
 *
 * NOTE: External service call ke POST /api/v3/adScore (adhub.nahsehat.id)
 * sudah dihapus karena tidak digunakan lagi. Halaman AdScore Provider
 * sekarang sepenuhnya menggunakan demo/simulasi data.
 */

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
