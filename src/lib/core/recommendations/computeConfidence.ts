/**
 * Pure, deterministic confidence scoring.
 * No IO — all data arrives via parameters.
 *
 * Decomposes confidence into three factors:
 *   - data_availability: how many signal sources are present
 *   - signal_consistency: do recovery signals agree with each other
 *   - data_recency: how fresh is the latest data
 *
 * Also detects baseline mode (cold_start / building / mature) based on
 * total days of user data.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConfidenceBreakdown {
  data_availability: number;
  signal_consistency: number;
  data_recency: number;
  overall: number;
}

export type BaselineMode = "cold_start" | "building" | "mature";

// ---------------------------------------------------------------------------
// Data availability (0-1): proportion of 4 possible sources present
// ---------------------------------------------------------------------------

export function computeDataAvailability(
  sleepPresent: boolean,
  hrvPresent: boolean,
  metricsPresent: boolean,
  loadPresent: boolean,
): number {
  const count =
    (sleepPresent ? 1 : 0) +
    (hrvPresent ? 1 : 0) +
    (metricsPresent ? 1 : 0) +
    (loadPresent ? 1 : 0);
  return count / 4;
}

// ---------------------------------------------------------------------------
// Signal consistency (0-1): how much recovery signals agree
// ---------------------------------------------------------------------------

/**
 * Measures agreement between recovery signals (each 0-1).
 * Two signals that perfectly agree → 1.0.
 * High standard deviation (>0.3) → drops toward 0.
 *
 * Returns 1.0 when fewer than 2 signals (nothing to contradict).
 */
export function computeSignalConsistency(signals: number[]): number {
  if (signals.length < 2) return 1.0;

  const mean = signals.reduce((a, b) => a + b, 0) / signals.length;
  const variance =
    signals.reduce((sum, s) => sum + (s - mean) ** 2, 0) / signals.length;
  const stdDev = Math.sqrt(variance);

  // Map stdDev 0→1.0, 0.3→0.0 (linear), clamp to [0, 1]
  return Math.max(0, Math.min(1, 1 - stdDev / 0.3));
}

// ---------------------------------------------------------------------------
// Data recency (0-1): how fresh the latest data is
// ---------------------------------------------------------------------------

/**
 * Scores data freshness based on hours since last data point.
 * Takes both timestamps as params to stay pure.
 *
 * ≤6h → 1.0, ≤12h → 0.9, ≤24h → 0.7, ≤48h → 0.4, else → 0.2
 */
export function computeDataRecency(
  latestTimestamp: string,
  currentTimestamp: string,
): number {
  const latestMs = new Date(latestTimestamp).getTime();
  const currentMs = new Date(currentTimestamp).getTime();

  if (isNaN(latestMs) || isNaN(currentMs)) return 0.2;

  const hoursDiff = Math.max(0, (currentMs - latestMs) / (1000 * 60 * 60));

  if (hoursDiff <= 6) return 1.0;
  if (hoursDiff <= 12) return 0.9;
  if (hoursDiff <= 24) return 0.7;
  if (hoursDiff <= 48) return 0.4;
  return 0.2;
}

// ---------------------------------------------------------------------------
// Baseline mode detection
// ---------------------------------------------------------------------------

/**
 * Detects user maturity based on total calendar days of data.
 * - cold_start: <7 days
 * - building: 7-20 days
 * - mature: 21+ days
 */
export function detectBaselineMode(totalDataDays: number): BaselineMode {
  if (totalDataDays < 7) return "cold_start";
  if (totalDataDays < 21) return "building";
  return "mature";
}

// ---------------------------------------------------------------------------
// Composite confidence
// ---------------------------------------------------------------------------

interface ConfidenceComponents {
  data_availability: number;
  signal_consistency: number;
  data_recency: number;
}

/**
 * Weighted composite of the three confidence factors.
 * Weights shift by baseline mode:
 *   - cold_start: emphasizes data_availability (0.6)
 *   - building:   balanced weights
 *   - mature:     emphasizes signal_consistency (0.4)
 */
export function computeCompositeConfidence(
  components: ConfidenceComponents,
  baselineMode: BaselineMode,
): ConfidenceBreakdown {
  let wAvail: number;
  let wConsistency: number;
  let wRecency: number;

  switch (baselineMode) {
    case "cold_start":
      wAvail = 0.6;
      wConsistency = 0.2;
      wRecency = 0.2;
      break;
    case "building":
      wAvail = 0.35;
      wConsistency = 0.35;
      wRecency = 0.3;
      break;
    case "mature":
      wAvail = 0.3;
      wConsistency = 0.4;
      wRecency = 0.3;
      break;
  }

  const overall = Math.max(
    0,
    Math.min(
      1,
      wAvail * components.data_availability +
        wConsistency * components.signal_consistency +
        wRecency * components.data_recency,
    ),
  );

  return {
    data_availability: components.data_availability,
    signal_consistency: components.signal_consistency,
    data_recency: components.data_recency,
    overall: +overall.toFixed(3),
  };
}
