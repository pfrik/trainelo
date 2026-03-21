/**
 * Pure detection functions for passive calibration.
 * No IO — all functions take data arrays and return detection results.
 */

import type {
  WorkoutHRSample,
  RestingHRSample,
  HRVSample,
  DetectionResult,
  ConfidenceResult,
  ConfidenceLevel,
  ThresholdType,
} from "./types.js";
import { SIGNIFICANT_CHANGE } from "./types.js";

// ============================================================================
// Helpers
// ============================================================================

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  if (avg === 0) return 0;
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance) / avg;
}

function interquartileRange(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const q1Idx = Math.floor(sorted.length * 0.25);
  const q3Idx = Math.floor(sorted.length * 0.75);
  return sorted[q3Idx] - sorted[q1Idx];
}

function toConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.7) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}

// ============================================================================
// Confidence Scoring
// ============================================================================

/**
 * Compute confidence score for a detection result.
 *
 * Factors:
 *  - Data quantity: +0.05 per point above minimum (cap base at ~0.85)
 *  - Data consistency: -0.15 if high variance
 *  - Data recency: -0.10 if newest sample is stale
 */
export function computeConfidenceScore(
  values: number[],
  minPoints: number,
  newestDate: string,
  referenceDate: string,
  stalenessDays: number,
): ConfidenceResult {
  // Base: start at 0.3, add 0.05 per point above minimum, cap at 0.85
  const extraPoints = values.length - minPoints;
  let score = Math.min(0.3 + extraPoints * 0.05, 0.85);

  // Consistency penalty: high CoV or IQR relative to median
  const cov = coefficientOfVariation(values);
  if (cov > 0.15) {
    score -= 0.15;
  }

  // Recency penalty
  const newestMs = new Date(newestDate + "T00:00:00Z").getTime();
  const refMs = new Date(referenceDate + "T00:00:00Z").getTime();
  const daysSinceNewest = (refMs - newestMs) / (24 * 60 * 60 * 1000);
  if (daysSinceNewest > stalenessDays) {
    score -= 0.10;
  }

  score = Math.max(0, Math.min(1, score));
  return { score, level: toConfidenceLevel(score) };
}

// ============================================================================
// HR Max Detection
// ============================================================================

const HR_MAX_MIN_POINTS = 3;
const HR_MAX_MIN_HR = 100;
const HR_MAX_MAX_HR = 230;
const HR_MAX_MIN_DURATION = 600; // 10 minutes in seconds
const HR_MAX_STALENESS_DAYS = 30;

/**
 * Detect HR Max from workout max HR samples.
 * Method: Average of top 2 values from valid workouts (filters single sensor spikes).
 *
 * @param samples - 90 days of workout max HR data
 * @param referenceDate - Date to measure recency against
 * @returns DetectionResult or null if insufficient data
 */
export function detectHRMax(
  samples: WorkoutHRSample[],
  referenceDate: string,
): DetectionResult | null {
  // Filter: duration >= 10min, HR in 100–230 range
  const valid = samples.filter(
    (s) =>
      s.duration_seconds >= HR_MAX_MIN_DURATION &&
      s.max_heart_rate >= HR_MAX_MIN_HR &&
      s.max_heart_rate <= HR_MAX_MAX_HR,
  );

  if (valid.length < HR_MAX_MIN_POINTS) return null;

  // Sort by max HR descending, take top 2
  const sorted = [...valid].sort((a, b) => b.max_heart_rate - a.max_heart_rate);
  const top2 = sorted.slice(0, 2);
  const value = Math.round(mean(top2.map((s) => s.max_heart_rate)));

  // Find newest date for recency check
  const allHRValues = valid.map((s) => s.max_heart_rate);
  const newestDate = valid.reduce((latest, s) =>
    s.date > latest ? s.date : latest, valid[0].date);

  const confidence = computeConfidenceScore(
    allHRValues,
    HR_MAX_MIN_POINTS,
    newestDate,
    referenceDate,
    HR_MAX_STALENESS_DAYS,
  );

  return {
    value,
    confidence,
    dataPoints: valid.length,
    method: "top2_average",
  };
}

// ============================================================================
// Resting HR Detection
// ============================================================================

const RHR_MIN_POINTS = 7;
const RHR_MIN_HR = 30;
const RHR_MAX_HR = 120;
const RHR_STALENESS_DAYS = 3;

/**
 * Detect Resting HR from daily metrics.
 * Method: Median of recent 14 days (robust to outliers).
 *
 * @param samples - 14 days of daily RHR data
 * @param referenceDate - Date to measure recency against
 * @returns DetectionResult or null if insufficient data
 */
export function detectRestingHR(
  samples: RestingHRSample[],
  referenceDate: string,
): DetectionResult | null {
  // Filter to valid range
  const valid = samples.filter(
    (s) => s.resting_heart_rate >= RHR_MIN_HR && s.resting_heart_rate <= RHR_MAX_HR,
  );

  if (valid.length < RHR_MIN_POINTS) return null;

  const values = valid.map((s) => s.resting_heart_rate);
  const value = Math.round(median(values));

  const newestDate = valid.reduce((latest, s) =>
    s.date > latest ? s.date : latest, valid[0].date);

  const confidence = computeConfidenceScore(
    values,
    RHR_MIN_POINTS,
    newestDate,
    referenceDate,
    RHR_STALENESS_DAYS,
  );

  return {
    value,
    confidence,
    dataPoints: valid.length,
    method: "median_14d",
  };
}

// ============================================================================
// HRV Baseline Detection
// ============================================================================

const HRV_MIN_POINTS = 7;
const HRV_MIN_MS = 5;
const HRV_MAX_MS = 200;
const HRV_STALENESS_DAYS = 3;

/**
 * Detect HRV Baseline from nightly HRV data.
 * Method: Median of recent 14 days.
 *
 * @param samples - 14 days of nightly HRV data
 * @param referenceDate - Date to measure recency against
 * @returns DetectionResult or null if insufficient data
 */
export function detectHRVBaseline(
  samples: HRVSample[],
  referenceDate: string,
): DetectionResult | null {
  // Filter to valid range
  const valid = samples.filter(
    (s) => s.hrv_rmssd >= HRV_MIN_MS && s.hrv_rmssd <= HRV_MAX_MS,
  );

  if (valid.length < HRV_MIN_POINTS) return null;

  const values = valid.map((s) => s.hrv_rmssd);
  const value = Math.round(median(values));

  const newestDate = valid.reduce((latest, s) =>
    s.date > latest ? s.date : latest, valid[0].date);

  const confidence = computeConfidenceScore(
    values,
    HRV_MIN_POINTS,
    newestDate,
    referenceDate,
    HRV_STALENESS_DAYS,
  );

  return {
    value,
    confidence,
    dataPoints: valid.length,
    method: "median_14d",
  };
}

// ============================================================================
// Significant Change Check
// ============================================================================

/**
 * Check if a detected value represents a significant change from the existing value.
 * Returns true if the change exceeds the threshold for the given type.
 */
export function hasSignificantChange(
  thresholdType: ThresholdType,
  newValue: number,
  existingValue: number | null,
): boolean {
  if (existingValue == null) return true; // No existing → always significant
  const delta = Math.abs(newValue - existingValue);
  return delta >= SIGNIFICANT_CHANGE[thresholdType];
}
