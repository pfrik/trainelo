/**
 * Pure, deterministic readiness & fatigue scorer.
 * No IO — all data arrives via the input parameter.
 *
 * Returns readiness_score (0-100), fatigue_score (0-100),
 * and a non-empty array of reason codes explaining the scores.
 */

import type {
  SleepSessionInput,
  HrvNightInput,
  DailyMetricsInput,
  TrainingLoadInput,
} from "./computeDailyRecommendation";
import type { ReasonCode } from "../contracts";

// ---------------------------------------------------------------------------
// Input / Output types
// ---------------------------------------------------------------------------

/** Morning check-in subjective signals (all optional/nullable). */
export interface DailyCheckinInput {
  mood?: "drained" | "tired" | "okay" | "good" | "great" | null;
  rpe?: number | null;
  soreness?: number | null;
  pain_flag?: boolean | null;
  illness_flag?: boolean | null;
}

export interface ReadinessAndFatigueInput {
  sleep: SleepSessionInput | null;
  hrv: HrvNightInput | null;
  metrics: DailyMetricsInput | null;
  trainingLoad7Days: TrainingLoadInput[];
  dailyCheckin?: DailyCheckinInput | null;
}

export interface ReadinessAndFatigueOutput {
  /** 0-100 overall readiness to train. */
  readiness_score: number;
  /** 0-100 accumulated fatigue from recent training load. */
  fatigue_score: number;
  /** Non-empty array of codes explaining the scores. */
  reason_codes: ReasonCode[];
}

// ---------------------------------------------------------------------------
// Thresholds (explicit, rule-based)
// ---------------------------------------------------------------------------

/** Sleep score (0-100) below which SLEEP_POOR fires. */
const SLEEP_SCORE_LOW = 60;
/** Hours of sleep below which SLEEP_POOR fires. */
const SLEEP_HOURS_LOW = 6;
/** HRV rmssd / baseline ratio below which HRV_LOW fires. */
const HRV_SUPPRESSION_RATIO = 0.8;
/** 7-day total TSS above which TRAINING_LOAD_HIGH fires. */
const ACUTE_TSS_THRESHOLD = 500;
/** 7-day total TSS representing "maximum" fatigue (fatigue_score = 100). */
const MAX_TSS_REFERENCE = 700;
/** Minimum data sources to avoid INSUFFICIENT_DATA. */
const MIN_DATA_SOURCES = 2;

// ---------------------------------------------------------------------------
// Check-in adjustment constants
// ---------------------------------------------------------------------------

/** Additive readiness/fatigue deltas per mood value. */
const MOOD_ADJUSTMENTS: Record<string, { readiness: number; fatigue: number }> = {
  drained: { readiness: -15, fatigue: 15 },
  tired:   { readiness: -8,  fatigue: 8 },
  okay:    { readiness: 0,   fatigue: 0 },
  good:    { readiness: 5,   fatigue: -5 },
  great:   { readiness: 5,   fatigue: -5 },
};

/** RPE at or above this value adds fatigue. */
const RPE_HIGH_THRESHOLD = 8;
const RPE_HIGH_FATIGUE_DELTA = 8;

/** Soreness at or above this value adds fatigue. */
const SORENESS_HIGH_THRESHOLD = 7;
const SORENESS_HIGH_FATIGUE_DELTA = 8;

/** Pain flag adjustments. */
const PAIN_READINESS_DELTA = -15;
const PAIN_FATIGUE_DELTA = 12;

/** Illness flag adjustments. */
const ILLNESS_READINESS_DELTA = -20;
const ILLNESS_FATIGUE_DELTA = 15;

// ---------------------------------------------------------------------------
// Scoring helpers (all pure)
// ---------------------------------------------------------------------------

/** Clamp value between 0 and 1. */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Clamp integer to 0..100. */
function clamp0100(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

/**
 * Recovery signal from sleep data (0 = poor, 1 = excellent).
 * 60 % weight on sleep_score, 40 % on duration proximity to 8 h.
 */
function sleepSignal(s: SleepSessionInput): number {
  const scoreNorm = clamp01(s.sleep_score / 100);
  const hoursSlept = s.duration_seconds / 3600;
  const durationNorm = clamp01(1 - Math.abs(hoursSlept - 8) / 4);
  return 0.6 * scoreNorm + 0.4 * durationNorm;
}

/**
 * Recovery signal from HRV data (0 = suppressed, 1 = at/above baseline).
 * Returns 0.5 (neutral) when baseline is unusable.
 */
function hrvSignal(h: HrvNightInput): number {
  if (h.hrv_baseline <= 0) return 0.5;
  return clamp01(h.hrv_rmssd / h.hrv_baseline);
}

/** Recovery signal from daily metrics (0 = poor, 1 = excellent). */
function metricsSignal(m: DailyMetricsInput): number {
  return clamp01(m.recovery_score / 100);
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export function computeReadinessAndFatigue(
  input: ReadinessAndFatigueInput,
): ReadinessAndFatigueOutput {
  const { sleep, hrv, metrics, trainingLoad7Days } = input;
  const reasons: ReasonCode[] = [];

  // --- Count available data sources ---
  const dataCount =
    (sleep ? 1 : 0) +
    (hrv ? 1 : 0) +
    (metrics ? 1 : 0) +
    (trainingLoad7Days.length > 0 ? 1 : 0);

  if (dataCount < MIN_DATA_SOURCES) {
    reasons.push("INSUFFICIENT_DATA");
  }

  // --- Sleep ---
  let sleepVal: number | null = null;
  if (sleep) {
    sleepVal = sleepSignal(sleep);
    const hoursSlept = sleep.duration_seconds / 3600;
    if (sleep.sleep_score < SLEEP_SCORE_LOW || hoursSlept < SLEEP_HOURS_LOW) {
      reasons.push("SLEEP_POOR");
    }
  }

  // --- HRV ---
  let hrvVal: number | null = null;
  if (hrv) {
    hrvVal = hrvSignal(hrv);
    if (hrv.hrv_baseline > 0 && hrv.hrv_rmssd / hrv.hrv_baseline < HRV_SUPPRESSION_RATIO) {
      reasons.push("HRV_LOW");
    }
  }

  // --- Metrics ---
  let metricsVal: number | null = null;
  if (metrics) {
    metricsVal = metricsSignal(metrics);
  }

  // --- Fatigue from 7-day training load ---
  const totalTss = trainingLoad7Days.reduce((sum, l) => sum + l.total_tss, 0);
  const fatigueNorm = clamp01(totalTss / MAX_TSS_REFERENCE);
  let fatigue_score = Math.round(fatigueNorm * 100);

  if (totalTss > ACUTE_TSS_THRESHOLD) {
    reasons.push("TRAINING_LOAD_HIGH");
  }

  // --- Readiness ---
  const signals = [sleepVal, hrvVal, metricsVal].filter(
    (s): s is number => s !== null,
  );
  const avgRecovery =
    signals.length > 0
      ? signals.reduce((a, b) => a + b, 0) / signals.length
      : 0.5; // neutral when no recovery data

  const readinessNorm = clamp01(avgRecovery - fatigueNorm * 0.3);
  let readiness_score = Math.round(readinessNorm * 100);

  // --- Daily check-in adjustments ---
  const checkin = input.dailyCheckin;
  if (checkin) {
    let readinessDelta = 0;
    let fatigueDelta = 0;

    // Mood
    if (checkin.mood) {
      const adj = MOOD_ADJUSTMENTS[checkin.mood];
      if (adj) {
        readinessDelta += adj.readiness;
        fatigueDelta += adj.fatigue;
      }
      if (checkin.mood === "drained" || checkin.mood === "tired") {
        if (!reasons.includes("FATIGUE_ELEVATED")) {
          reasons.push("FATIGUE_ELEVATED");
        }
      }
    }

    // High RPE
    if (checkin.rpe != null && checkin.rpe >= RPE_HIGH_THRESHOLD) {
      fatigueDelta += RPE_HIGH_FATIGUE_DELTA;
      if (!reasons.includes("FATIGUE_ELEVATED")) {
        reasons.push("FATIGUE_ELEVATED");
      }
    }

    // High soreness
    if (checkin.soreness != null && checkin.soreness >= SORENESS_HIGH_THRESHOLD) {
      fatigueDelta += SORENESS_HIGH_FATIGUE_DELTA;
      if (!reasons.includes("FATIGUE_ELEVATED")) {
        reasons.push("FATIGUE_ELEVATED");
      }
    }

    // Pain flag
    if (checkin.pain_flag) {
      readinessDelta += PAIN_READINESS_DELTA;
      fatigueDelta += PAIN_FATIGUE_DELTA;
      if (!reasons.includes("FATIGUE_HIGH")) {
        reasons.push("FATIGUE_HIGH");
      }
    }

    // Illness flag
    if (checkin.illness_flag) {
      readinessDelta += ILLNESS_READINESS_DELTA;
      fatigueDelta += ILLNESS_FATIGUE_DELTA;
      if (!reasons.includes("FATIGUE_HIGH")) {
        reasons.push("FATIGUE_HIGH");
      }
    }

    readiness_score = clamp0100(readiness_score + readinessDelta);
    fatigue_score = clamp0100(fatigue_score + fatigueDelta);
  }

  // --- Guarantee non-empty reason_codes ---
  if (reasons.length === 0) {
    reasons.push("RECOVERY_OPTIMAL");
  }

  return { readiness_score, fatigue_score, reason_codes: reasons };
}
