/**
 * Pure, deterministic trend detection for recommendation reason codes.
 * No IO — all data arrives via parameters.
 *
 * Each detector returns a ReasonCode or null.
 */

import type { ReasonCode } from "../contracts/index.js";
import type { BaselineMode } from "./computeConfidence.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HrvHistoryEntry {
  date: string;
  hrv_rmssd: number;
}

export type TrendDirection = "declining" | "stable" | "rising";
export type TrendConfirmation = "tentative" | "confirmed";

export interface TrendState {
  metric: "hrv" | "training_load" | "streak";
  direction: TrendDirection;
  confirmation: TrendConfirmation;
  persistence_detail: string;
  reason_code: ReasonCode | null;
}

export interface TrendDetectionResult {
  code: ReasonCode | null;
  hits: number;
  windows: number;
}

// ---------------------------------------------------------------------------
// Trivial-band constants
// ---------------------------------------------------------------------------

/** Smallest worthwhile change as fraction of baseline. */
export const HRV_SWC_PCT = 0.05;
/** Absolute floor for the trivial band (ms). */
export const HRV_SWC_ABS_FLOOR = 2;

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
// Trivial-band gating
// ---------------------------------------------------------------------------

/**
 * Returns true when the projected total change over the window
 * exceeds the trivial band (smallest worthwhile change).
 *
 * Band = max(5% of reference, 2ms absolute floor).
 * Reference = baseline when available, otherwise mean.
 */
export function exceedsTrivialBand(
  slope: number,
  mean: number,
  baseline: number | null | undefined,
  windowDays: number,
): boolean {
  const reference = baseline != null && baseline > 0 ? baseline : mean;
  if (reference <= 0) return false;

  const totalChange = Math.abs(slope * (windowDays - 1));
  const band = Math.max(reference * HRV_SWC_PCT, HRV_SWC_ABS_FLOOR);
  return totalChange > band;
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
 * Now also applies trivial-band gating when hrvBaseline is provided:
 * the total projected change must exceed max(5% of baseline, 2ms).
 *
 * @param hrvHistory - newest-first HRV entries (typically 5-7 days)
 * @param hrvBaseline - baseline HRV for trivial-band comparison
 */
export function detectHrvDeclining(
  hrvHistory: HrvHistoryEntry[],
  hrvBaseline?: number | null,
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

  // Fire when declining more than 2% per day AND exceeds trivial band
  if (slopePctPerDay < -2) {
    if (!exceedsTrivialBand(slope, mean, hrvBaseline, values.length)) {
      return null;
    }
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

// ---------------------------------------------------------------------------
// Persistent HRV declining detection (sliding sub-windows)
// ---------------------------------------------------------------------------

/**
 * Persistent version of HRV declining that requires multiple
 * sub-windows to confirm before firing.
 *
 * Runs sliding sub-windows of size 4 over up to 10 entries.
 * Each sub-window independently checks slope < -2%/day AND trivial band.
 * Requires ≥60% of sub-windows to fire.
 *
 * With < 4 entries, returns no detection (insufficient data).
 * With exactly 4 entries (1 window), fires on that single window
 * (graceful fallback for short history).
 */
export function detectHrvDecliningPersistent(
  hrvHistory: HrvHistoryEntry[],
  hrvBaseline?: number | null,
): TrendDetectionResult {
  const noResult: TrendDetectionResult = { code: null, hits: 0, windows: 0 };

  if (hrvHistory.length < 4) return noResult;

  // Cap at 10 entries, oldest-first
  const allValues = hrvHistory
    .slice(0, 10)
    .map((e) => e.hrv_rmssd)
    .reverse();

  const windowSize = 4;
  const numWindows = allValues.length - windowSize + 1;
  let hits = 0;

  for (let i = 0; i < numWindows; i++) {
    const window = allValues.slice(i, i + windowSize);
    const slope = linearSlope(window);
    if (slope === null) continue;

    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    if (mean <= 0) continue;

    const slopePctPerDay = (slope / mean) * 100;
    if (slopePctPerDay < -2 && exceedsTrivialBand(slope, mean, hrvBaseline, windowSize)) {
      hits++;
    }
  }

  const threshold = numWindows === 1 ? 1 : Math.ceil(numWindows * 0.6);
  const fires = hits >= threshold;

  return {
    code: fires ? "HRV_DECLINING" : null,
    hits,
    windows: numWindows,
  };
}

// ---------------------------------------------------------------------------
// HRV direction helper
// ---------------------------------------------------------------------------

/**
 * Determines HRV direction from slope percentage.
 * < -1%/day = declining, > +1%/day = rising, else stable.
 */
function determineHrvDirection(hrvHistory: HrvHistoryEntry[]): TrendDirection {
  if (hrvHistory.length < 4) return "stable";

  const values = hrvHistory
    .slice(0, 7)
    .map((e) => e.hrv_rmssd)
    .reverse();

  const slope = linearSlope(values);
  if (slope === null) return "stable";

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean <= 0) return "stable";

  const slopePctPerDay = (slope / mean) * 100;
  if (slopePctPerDay < -1) return "declining";
  if (slopePctPerDay > 1) return "rising";
  return "stable";
}

// ---------------------------------------------------------------------------
// Structured trend states
// ---------------------------------------------------------------------------

/**
 * Computes structured trend states for all tracked metrics.
 *
 * Returns an array of TrendState objects with direction,
 * confirmation level, and associated reason codes.
 */
export function computeTrendStates(
  hrvHistory: HrvHistoryEntry[] | null | undefined,
  hrvBaseline: number | null | undefined,
  chronicLoad28d: number | null | undefined,
  priorChronicLoad28d: number | null | undefined,
  consecutiveTrainingDays: number | null | undefined,
  baselineMode: BaselineMode | null | undefined,
): TrendState[] {
  const states: TrendState[] = [];

  // --- HRV trend ---
  if (hrvHistory && hrvHistory.length >= 4) {
    const direction = determineHrvDirection(hrvHistory);
    const persistent = detectHrvDecliningPersistent(hrvHistory, hrvBaseline);

    let confirmation: TrendConfirmation = "tentative";
    let reasonCode: ReasonCode | null = null;
    let persistenceDetail = "single_window";

    if (persistent.windows > 0) {
      persistenceDetail = `${persistent.hits}_of_${persistent.windows}`;
      if (persistent.code) {
        confirmation = "confirmed";
        reasonCode = persistent.code;
      }
    }

    states.push({
      metric: "hrv",
      direction,
      confirmation,
      persistence_detail: persistenceDetail,
      reason_code: reasonCode,
    });
  }

  // --- Training load trend ---
  if (chronicLoad28d != null && priorChronicLoad28d != null && priorChronicLoad28d > 0) {
    const ratio = chronicLoad28d / priorChronicLoad28d;
    let direction: TrendDirection = "stable";
    let reasonCode: ReasonCode | null = null;

    if (ratio < 0.6) {
      direction = "declining";
      reasonCode = "TRAINING_LOAD_LOW";
    } else if (ratio >= 1.2) {
      direction = "rising";
      if (baselineMode && baselineMode !== "cold_start") {
        reasonCode = "ADAPTATION_PHASE";
      }
    }

    states.push({
      metric: "training_load",
      direction,
      confirmation: "confirmed",
      persistence_detail: "28d_aggregate",
      reason_code: reasonCode,
    });
  }

  // --- Streak trend ---
  if (consecutiveTrainingDays != null) {
    const direction: TrendDirection = consecutiveTrainingDays >= 5 ? "rising" : "stable";
    const reasonCode = consecutiveTrainingDays >= 5 ? "STREAK_RISK" : null;

    states.push({
      metric: "streak",
      direction,
      confirmation: "confirmed",
      persistence_detail: `${consecutiveTrainingDays}d_consecutive`,
      reason_code: reasonCode,
    });
  }

  return states;
}
