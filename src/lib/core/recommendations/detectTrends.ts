/**
 * Pure, deterministic trend detection for recommendation reason codes.
 * No IO — all data arrives via parameters.
 *
 * Each detector returns a ReasonCode or null.
 */

import type { ReasonCode } from "../contracts";
import type { BaselineMode } from "./computeConfidence";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HrvHistoryEntry {
  date: string;
  hrv_rmssd: number;
}

// ---------------------------------------------------------------------------
// Linear regression helper
// ---------------------------------------------------------------------------

/**
 * Simple linear regression returning slope per unit index.
 * values[0] is the oldest, values[n-1] is the newest.
 * Returns null if fewer than 2 points.
 */
export function linearSlope(values: number[]): number | null {
  const n = values.length;
  if (n < 2) return null;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;

  return (n * sumXY - sumX * sumY) / denom;
}

// ---------------------------------------------------------------------------
// HRV declining detection
// ---------------------------------------------------------------------------

/**
 * Detects a declining HRV trend from a history window.
 *
 * Uses 5-day linear regression on HRV rmssd values.
 * Fires HRV_DECLINING when slope < -2%/day of the mean
 * (≥10% drop over 5 days). Requires ≥4 data points.
 *
 * @param hrvHistory - newest-first HRV entries (typically 5-7 days)
 * @param _hrvBaseline - reserved for future use (baseline comparison)
 */
export function detectHrvDeclining(
  hrvHistory: HrvHistoryEntry[],
  _hrvBaseline?: number | null,
): ReasonCode | null {
  if (hrvHistory.length < 4) return null;

  // Reverse to oldest-first for regression (slope sign: positive = increasing)
  const values = hrvHistory
    .slice(0, 7) // cap at 7 days
    .map((e) => e.hrv_rmssd)
    .reverse();

  const slope = linearSlope(values);
  if (slope === null) return null;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean <= 0) return null;

  // Slope as percentage of mean per day
  const slopePctPerDay = (slope / mean) * 100;

  // Fire when declining more than 2% per day
  if (slopePctPerDay < -2) {
    return "HRV_DECLINING";
  }

  return null;
}

// ---------------------------------------------------------------------------
// Training load low detection
// ---------------------------------------------------------------------------

/**
 * Detects significantly reduced training load.
 *
 * Fires TRAINING_LOAD_LOW when current 28d load < 60% of prior 28d load.
 */
export function detectTrainingLoadLow(
  chronicLoad28d: number | null,
  priorChronicLoad28d: number | null,
): ReasonCode | null {
  if (chronicLoad28d == null || priorChronicLoad28d == null) return null;
  if (priorChronicLoad28d <= 0) return null;

  const ratio = chronicLoad28d / priorChronicLoad28d;
  if (ratio < 0.6) {
    return "TRAINING_LOAD_LOW";
  }

  return null;
}

// ---------------------------------------------------------------------------
// Streak risk detection
// ---------------------------------------------------------------------------

/**
 * Detects streak risk — training too many consecutive days.
 *
 * Fires STREAK_RISK at 5+ consecutive training days.
 * This is an early warning before REST_DAY_DUE fires at 7 days.
 * Informational — does not change candidate tier.
 */
export function detectStreakRisk(
  consecutiveTrainingDays: number | null,
): ReasonCode | null {
  if (consecutiveTrainingDays == null) return null;

  if (consecutiveTrainingDays >= 5) {
    return "STREAK_RISK";
  }

  return null;
}

// ---------------------------------------------------------------------------
// Adaptation phase detection
// ---------------------------------------------------------------------------

/**
 * Detects an adaptation phase — the body adjusting to increased training.
 *
 * Fires ADAPTATION_PHASE when current 28d load is ≥120% of prior 28d load
 * and the user has enough history (not cold_start).
 *
 * Informational — signals the user's body may be adapting to a deliberate
 * load increase, so a temporary HRV dip or elevated fatigue is expected.
 */
export function detectAdaptationPhase(
  chronicLoad28d: number | null,
  priorChronicLoad28d: number | null,
  baselineMode: BaselineMode | null,
): ReasonCode | null {
  if (chronicLoad28d == null || priorChronicLoad28d == null) return null;
  if (priorChronicLoad28d <= 0) return null;
  // Not meaningful without enough history
  if (baselineMode === "cold_start" || baselineMode == null) return null;

  const ratio = chronicLoad28d / priorChronicLoad28d;
  if (ratio >= 1.2) {
    return "ADAPTATION_PHASE";
  }

  return null;
}
