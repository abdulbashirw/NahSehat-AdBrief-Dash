/**
 * AdScore type definitions and constants.
 *
 * Score scale: 1-20
 *   15-20 → Good Score (green)  — Pelayanan < SLA
 *   10-14 → Moderate (yellow)   — Pelayanan ≈ SLA
 *    1-9  → Bad Score (red)     — Pelayanan > SLA
 */

/* ─── Score Levels ─── */

export type ScoreLevel = 'good' | 'moderate' | 'bad';

export interface ScoreRange {
  min: number;
  max: number;
  level: ScoreLevel;
  label: string;
  labelId: string;
  description: string;
  descriptionId: string;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
}

export const SCORE_RANGES: ScoreRange[] = [
  {
    min: 15, max: 20, level: 'good',
    label: 'Good Score', labelId: 'Good Score',
    description: 'Pelayanan < SLA', descriptionId: 'Pelayanan < SLA',
    color: '#16A34A', bgColor: '#F0FDF4', borderColor: '#BBF7D0', textColor: '#15803D',
  },
  {
    min: 10, max: 14, level: 'moderate',
    label: 'Moderate', labelId: 'Moderate',
    description: 'Pelayanan ≈ SLA', descriptionId: 'Pelayanan ≈ SLA',
    color: '#CA8A04', bgColor: '#FEFCE8', borderColor: '#FDE68A', textColor: '#A16207',
  },
  {
    min: 1, max: 9, level: 'bad',
    label: 'Bad Score', labelId: 'Bad Score',
    description: 'Pelayanan > SLA', descriptionId: 'Pelayanan > SLA',
    color: '#DC2626', bgColor: '#FEF2F2', borderColor: '#FECACA', textColor: '#B91C1C',
  },
];

export const SCORE_COLORS: Record<ScoreLevel, string> = {
  good: '#16A34A',
  moderate: '#CA8A04',
  bad: '#DC2626',
};

export const SCORE_LABELS: Record<ScoreLevel, string> = {
  good: 'Good Score',
  moderate: 'Moderate',
  bad: 'Bad Score',
};

/* ─── Provider Types ─── */

export const PROVIDER_TYPES = [
  { value: 'RS', label: 'Rumah Sakit' },
  { value: 'Klinik', label: 'Klinik' },
  { value: 'Lab', label: 'Laboratorium' },
  { value: 'Klinik Gigi', label: 'Klinik Gigi' },
  { value: 'Apotek', label: 'Apotek' },
] as const;

export type ProviderType = (typeof PROVIDER_TYPES)[number]['value'];

/* ─── Search Form Types ─── */

export interface ProviderSearchParams {
  name: string;
  type: string;
  city: string;
}

export interface MemberSearchParams {
  fullName: string;
  birthDate: string;
}

export interface CorporateSearchParams {
  companyName: string;
  industry?: string;
}

export type SearchTab = 'member' | 'corporate';
