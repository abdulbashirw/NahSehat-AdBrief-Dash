/**
 * Pure aggregation helpers for AdScore.
 *
 * Mirrors the pattern from `entities/monitoring/lib/aggregate.ts`.
 */
import type { ScoreLevel } from '../model/adscoreTypes';
import { SCORE_RANGES } from '../model/adscoreTypes';
import type { AdScoreItem } from '../api/adscoreApi';

/**
 * Determine score level from a numeric score (1-20).
 */
export function computeScoreLevel(score: number): ScoreLevel {
  for (const range of SCORE_RANGES) {
    if (score >= range.min && score <= range.max) {
      return range.level;
    }
  }
  return 'bad'; // fallback
}

/**
 * Get the ScoreRange object for a given score.
 */
export function getScoreRange(score: number) {
  return SCORE_RANGES.find((r) => score >= r.min && score <= r.max) ?? SCORE_RANGES[2];
}

/* ─── Score Breakdown ─── */

export interface ScoreBreakdown {
  good: number;
  moderate: number;
  bad: number;
  total: number;
}

/**
 * Count items by score level.
 */
export function buildScoreBreakdown(items: AdScoreItem[]): ScoreBreakdown {
  let good = 0;
  let moderate = 0;
  let bad = 0;

  for (const item of items) {
    const score = Number(item?.header?.Score) || 0;
    const level = computeScoreLevel(score);
    if (level === 'good') good++;
    else if (level === 'moderate') moderate++;
    else bad++;
  }

  return { good, moderate, bad, total: items.length };
}

/**
 * Generate a deterministic demo score from a string input (1-20).
 * Used for demo/simulation when the API is still in development.
 */
export function generateDemoScore(input: string): number {
  if (!input || input.trim() === '') return 10;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Map to 1-20 range
  return (Math.abs(hash) % 20) + 1;
}
