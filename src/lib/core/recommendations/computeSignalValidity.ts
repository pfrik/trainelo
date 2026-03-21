/**
 * Per-signal validity assessment.
 * No IO — all data arrives via parameters.
 *
 * Each validator returns a SignalValidity describing whether the signal
 * is usable, plus a 0-1 quality score for graded confidence.
 */

import type {
  SleepSessionInput,
  HrvNightInput,
  DailyMetricsInput,
  TrainingLoadInput,
} from "./computeDailyRecommendation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SignalValidity {
  /** Whether this signal is usable (not garbage). */
  valid: boolean;
  /** 0-1 confidence in this specific signal. */
  quality: number;
  /** Reason for invalidity or degradation (when quality < 1). */
  invalid_reason?: string;
}

export interface SignalValidityReport {
  sleep: SignalValidity | null;   // null = absent
  hrv: SignalValidity | null;
  metrics: SignalValidity | null;
  load: SignalValidity | null;
}

// ---------------------------------------------------------------------------
// Sleep validation
// ---------------------------------------------------------------------------

/**
 * Validates a sleep session.
 *
 * - score=0 + duration=0 → invalid (garbage data from wearable)
 * - duration < 30min → invalid (not a real sleep session)
 * - score=0 but has duration → degraded (quality 0.3)
 * - Normal → quality scales with score (score/100)
 */
export function validateSleep(s: SleepSessionInput): SignalValidity {
  const durationMin = s.duration_seconds / 60;

  // Garbage: both zero
  if (s.sleep_score === 0 && s.duration_seconds === 0) {
    return { valid: false, quality: 0, invalid_reason: "zero_score_and_duration" };
  }

  // Too short to be real sleep
  if (durationMin < 30) {
    return { valid: false, quality: 0, invalid_reason: "duration_under_30min" };
  }

  // Score is zero but there is duration — degraded
  if (s.sleep_score === 0) {
    return { valid: true, quality: 0.3, invalid_reason: "zero_score_with_duration" };
  }

  // Normal: quality scales with score
  const quality = Math.max(0, Math.min(1, s.sleep_score / 100));
  return { valid: true, quality };
}

// ---------------------------------------------------------------------------
// HRV validation
// ---------------------------------------------------------------------------

/**
 * Validates an HRV reading.
 *
 * - rmssd ≤ 0 → invalid
 * - rmssd > 300 → invalid (physiologically implausible)
 * - baseline ≤ 0 → degraded (quality 0.4, can't compute ratio)
 * - Normal → quality 1.0
 */
export function validateHrv(h: HrvNightInput): SignalValidity {
  if (h.hrv_rmssd <= 0) {
    return { valid: false, quality: 0, invalid_reason: "rmssd_non_positive" };
  }

  if (h.hrv_rmssd > 300) {
    return { valid: false, quality: 0, invalid_reason: "rmssd_implausible" };
  }

  if (h.hrv_baseline <= 0) {
    return { valid: true, quality: 0.4, invalid_reason: "baseline_non_positive" };
  }

  return { valid: true, quality: 1.0 };
}

// ---------------------------------------------------------------------------
// Metrics validation
// ---------------------------------------------------------------------------

/**
 * Validates daily metrics.
 *
 * - recovery=0 + body_battery_high=0 + resting_heart_rate=0 → invalid (no real data)
 * - recovery=0 alone → degraded (quality 0.4)
 * - Normal → quality 1.0
 */
export function validateMetrics(m: DailyMetricsInput): SignalValidity {
  if (m.recovery_score === 0 && m.body_battery_high === 0 && m.resting_heart_rate === 0) {
    return { valid: false, quality: 0, invalid_reason: "all_zeros" };
  }

  if (m.recovery_score === 0) {
    return { valid: true, quality: 0.4, invalid_reason: "zero_recovery" };
  }

  return { valid: true, quality: 1.0 };
}

// ---------------------------------------------------------------------------
// Load validation
// ---------------------------------------------------------------------------

/**
 * Validates training load entries.
 *
 * - empty array → null (absent, not invalid)
 * - any negative TSS → degraded (quality 0.5)
 * - Normal → quality 1.0
 */
export function validateLoad(loads: TrainingLoadInput[]): SignalValidity | null {
  if (loads.length === 0) return null;

  const hasNegative = loads.some((l) => l.total_tss < 0);
  if (hasNegative) {
    return { valid: true, quality: 0.5, invalid_reason: "negative_tss" };
  }

  return { valid: true, quality: 1.0 };
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Computes a validity report for all available signals.
 * Null inputs produce null entries (absent, not invalid).
 */
export function computeSignalValidityReport(
  sleep: SleepSessionInput | null,
  hrv: HrvNightInput | null,
  metrics: DailyMetricsInput | null,
  loads: TrainingLoadInput[],
): SignalValidityReport {
  return {
    sleep: sleep ? validateSleep(sleep) : null,
    hrv: hrv ? validateHrv(hrv) : null,
    metrics: metrics ? validateMetrics(metrics) : null,
    load: validateLoad(loads),
  };
}
