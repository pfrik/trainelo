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
} from "./computeDailyRecommendation.js";
import type { ReasonCode } from "../contracts/index.js";
import type { ConfidenceBreakdown, BaselineMode } from "./computeConfidence.js";
import type { HrvHistoryEntry } from "./detectTrends.js";
import type { DailyTssEntry, NormalizedEwmaResult } from "./computeEwma.js";
import { computeEwma, normalizeEwma } from "./computeEwma.js";
import {
  computeDataAvailability,
  computeSignalConsistency,
  computeDataRecency,
  detectBaselineMode,
  computeCompositeConfidence,
} from "./computeConfidence.js";
import {
  detectHrvDeclining,
  detectTrainingLoadLow,
  detectStreakRisk,
  detectAdaptationPhase,
  computeTrendStates,
} from "./detectTrends.js";
import type { TrendState } from "./detectTrends.js";
import {
  computeSignalValidityReport,
} from "./computeSignalValidity.js";
import type { SignalValidityReport } from "./computeSignalValidity.js";

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

/** Calibrated personal thresholds from passive calibration. */
export interface PersonalThresholds {
  /** Calibrated HRV baseline (overrides Garmin nightly baseline). */
  hrv_baseline?: number | null;
  /** Calibrated HR max (for future zone calculations). */
  hr_max?: number | null;
  /** Calibrated resting HR (for RHR deviation detection). */
  resting_hr?: number | null;
}

export interface ReadinessAndFatigueInput {
  sleep: SleepSessionInput | null;
  hrv: HrvNightInput | null;
  metrics: DailyMetricsInput | null;
  trainingLoad7Days: TrainingLoadInput[];
  dailyCheckin?: DailyCheckinInput | null;
  /** 5-7 day HRV window, newest-first (for trend detection). */
  hrvHistory?: HrvHistoryEntry[] | null;
  /** Calendar days of user data (for baseline mode detection). */
  totalDataDays?: number | null;
  /** Consecutive training days from days_since_rest (for streak risk). */
  consecutiveTrainingDays?: number | null;
  /** 28-day chronic training load (from view). */
  chronicLoad28d?: number | null;
  /** Prior 28-day chronic load (from daily_user_state 28 days ago). */
  priorChronicLoad28d?: number | null;
  /** Timestamp of latest data sync (ISO 8601, for data recency). */
  latestDataTimestamp?: string | null;
  /** Current timestamp (ISO 8601) — injectable for purity; defaults to now. */
  currentTimestamp?: string | null;
  /** Extended daily TSS history (typically 63 days) for EWMA computation. */
  dailyTssHistory?: DailyTssEntry[] | null;
  /** Target date for EWMA alignment (YYYY-MM-DD). */
  targetDate?: string | null;
  /** Calibrated personal thresholds (from user_thresholds table). */
  personalThresholds?: PersonalThresholds | null;
  /** Yesterday's load surplus result (from compliance layer). */
  loadSurplus?: {
    surplus_ratio: number;
    has_unplanned_load: boolean;
    transferred_tss: number;
    cross_sport_tss: number;
  } | null;
}

export interface ReadinessAndFatigueOutput {
  /** 0-100 overall readiness to train. */
  readiness_score: number;
  /** 0-100 accumulated fatigue from recent training load. */
  fatigue_score: number;
  /** Non-empty array of codes explaining the scores. */
  reason_codes: ReasonCode[];
  /** Multi-factor confidence breakdown (present when totalDataDays or latestDataTimestamp provided). */
  confidence?: ConfidenceBreakdown;
  /** User maturity mode (present when totalDataDays provided). */
  baseline_mode?: BaselineMode;
  /** EWMA normalized result (present when dailyTssHistory provided). */
  ewma?: NormalizedEwmaResult;
  /** Per-signal validity report (present when any signal provided). */
  signal_validity?: SignalValidityReport;
  /** Structured trend labels (present when trend inputs provided). */
  trend_states?: TrendState[];
}

// ---------------------------------------------------------------------------
// Thresholds (explicit, rule-based)
// ---------------------------------------------------------------------------

/** Sleep score (0-100) below which SLEEP_POOR fires. */
const SLEEP_SCORE_LOW = 60;
/** Hours of sleep below which SLEEP_POOR fires. */
const SLEEP_HOURS_LOW = 6;
/** Hours of sleep above which oversleeping penalty applies (possible illness/overtraining). */
const SLEEP_HOURS_HIGH = 10;
/** HRV rmssd / baseline ratio below which HRV_LOW fires. */
const HRV_SUPPRESSION_RATIO = 0.8;
/** 7-day total TSS above which TRAINING_LOAD_HIGH fires. */
const ACUTE_TSS_THRESHOLD = 500;
/** 7-day total TSS representing "maximum" fatigue (fatigue_score = 100). */
const MAX_TSS_REFERENCE = 700;
/** Minimum data sources to avoid INSUFFICIENT_DATA. */
const MIN_DATA_SOURCES = 2;
/**
 * Fatigue penalty strength in readiness formula.
 * Multiplicative: readiness = recovery * (1 - fatigue * FATIGUE_PENALTY_STRENGTH).
 * At 0.6, max fatigue reduces readiness by 60% (e.g. recovery 0.85 → readiness 0.34).
 * Previous additive formula (recovery - fatigue * 0.3) only reduced by 30 points max.
 */
const FATIGUE_PENALTY_STRENGTH = 0.6;
/** Maximum readiness bonus from fitness (fitness_score/100 * this). */
const FITNESS_READINESS_WEIGHT = 0.15;
/** Normalized form score above which FORM_POSITIVE fires (0-100 scale). */
const FORM_POSITIVE_THRESHOLD = 10;
/** Normalized form score below which FORM_NEGATIVE fires (-100 to 0 scale). */
const FORM_NEGATIVE_THRESHOLD = -20;

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
 * 60 % weight on sleep_score, 40 % on duration quality.
 *
 * Duration scoring is asymmetric:
 * - Under 8h: linear penalty (4h→0, 8h→1) — undersleeping is common
 * - Over 8h: steeper penalty (8h→1, 10h→0.5, 12h→0) — oversleeping
 *   is a stronger signal of illness or overtraining than undersleeping
 */
function sleepSignal(s: SleepSessionInput): number {
  const scoreNorm = clamp01(s.sleep_score / 100);
  const hoursSlept = s.duration_seconds / 3600;
  let durationNorm: number;
  if (hoursSlept <= 8) {
    // Under 8h: linear from 0 (at 4h) to 1 (at 8h)
    durationNorm = clamp01((hoursSlept - 4) / 4);
  } else {
    // Over 8h: steeper decay — 0.5 at 10h, 0 at 12h
    durationNorm = clamp01(1 - (hoursSlept - 8) / 4);
  }
  return 0.6 * scoreNorm + 0.4 * durationNorm;
}

/**
 * Recovery signal from HRV data (0 = suppressed, 1 = at/above baseline).
 * Uses calibrated personal baseline when available, falls back to Garmin nightly baseline.
 * Returns 0.5 (neutral) when baseline is unusable.
 */
function hrvSignal(h: HrvNightInput, calibratedBaseline?: number | null): number {
  const baseline = (calibratedBaseline != null && calibratedBaseline > 0)
    ? calibratedBaseline
    : h.hrv_baseline;
  if (baseline <= 0) return 0.5;
  return clamp01(h.hrv_rmssd / baseline);
}

/** Threshold for RHR deviation: 10% above calibrated resting HR. */
const RHR_ELEVATION_RATIO = 1.10;

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
  const { sleep, hrv, metrics, trainingLoad7Days, personalThresholds } = input;
  const reasons: ReasonCode[] = [];

  // --- Signal validity (per-metric quality assessment) ---
  const validity = computeSignalValidityReport(sleep, hrv, metrics, trainingLoad7Days);
  const hasAnySignal = sleep || hrv || metrics || trainingLoad7Days.length > 0;

  // --- Count available data sources ---
  const dataCount =
    (sleep ? 1 : 0) +
    (hrv ? 1 : 0) +
    (metrics ? 1 : 0) +
    (trainingLoad7Days.length > 0 ? 1 : 0);

  if (dataCount < MIN_DATA_SOURCES) {
    reasons.push("INSUFFICIENT_DATA");
  }

  // --- Sleep (skip invalid signals) ---
  let sleepVal: number | null = null;
  if (sleep && validity.sleep && validity.sleep.valid) {
    sleepVal = sleepSignal(sleep);
    const hoursSlept = sleep.duration_seconds / 3600;
    if (
      sleep.sleep_score < SLEEP_SCORE_LOW ||
      hoursSlept < SLEEP_HOURS_LOW ||
      hoursSlept >= SLEEP_HOURS_HIGH
    ) {
      reasons.push("SLEEP_POOR");
    }
  }

  // --- HRV (skip invalid signals) ---
  let hrvVal: number | null = null;
  const calibratedHrvBaseline = personalThresholds?.hrv_baseline;
  if (hrv && validity.hrv && validity.hrv.valid) {
    hrvVal = hrvSignal(hrv, calibratedHrvBaseline);
    // Use calibrated baseline for suppression check when available
    const effectiveBaseline = (calibratedHrvBaseline != null && calibratedHrvBaseline > 0)
      ? calibratedHrvBaseline
      : hrv.hrv_baseline;
    if (effectiveBaseline > 0 && hrv.hrv_rmssd / effectiveBaseline < HRV_SUPPRESSION_RATIO) {
      reasons.push("HRV_LOW");
    }
  }

  // --- Metrics (skip invalid signals) ---
  let metricsVal: number | null = null;
  if (metrics && validity.metrics && validity.metrics.valid) {
    metricsVal = metricsSignal(metrics);
  }

  // --- RHR elevation check (when calibrated resting HR available) ---
  if (
    metrics &&
    metrics.resting_heart_rate > 0 &&
    personalThresholds?.resting_hr != null &&
    personalThresholds.resting_hr > 0 &&
    metrics.resting_heart_rate > personalThresholds.resting_hr * RHR_ELEVATION_RATIO
  ) {
    reasons.push("RHR_ELEVATED");
  }

  // --- Fatigue from 7-day training load ---
  const totalTss = trainingLoad7Days.reduce((sum, l) => sum + l.total_tss, 0);
  const fatigueNorm = clamp01(totalTss / MAX_TSS_REFERENCE);
  let fatigue_score = Math.round(fatigueNorm * 100);

  // --- EWMA fitness/fatigue (when extended history provided) ---
  let ewma: NormalizedEwmaResult | undefined;
  if (
    input.dailyTssHistory &&
    input.dailyTssHistory.length > 0 &&
    input.targetDate
  ) {
    const rawEwma = computeEwma(input.dailyTssHistory, input.targetDate);
    ewma = normalizeEwma(rawEwma);

    // Replace flat-sum fatigue with EWMA fatigue when not in cold start
    if (!ewma.cold_start_fatigue) {
      fatigue_score = ewma.fatigue_score;
    }

    // Form reason codes — use normalized form_score so thresholds are
    // meaningful for all athlete levels, not just high-volume ones.
    if (ewma.form_score > FORM_POSITIVE_THRESHOLD) {
      reasons.push("FORM_POSITIVE");
    } else if (ewma.form_score < FORM_NEGATIVE_THRESHOLD) {
      reasons.push("FORM_NEGATIVE");
    }
  }

  // TRAINING_LOAD_HIGH: use EWMA fatigue when available (harmonized),
  // otherwise fall back to flat 7-day TSS sum. This prevents the
  // contradictory state where EWMA fatigue=30 but TRAINING_LOAD_HIGH
  // fires because the flat sum > 500.
  if (ewma && !ewma.cold_start_fatigue) {
    if (ewma.fatigue_score >= 71) {
      // EWMA fatigue ≥71 ≈ equivalent to the old 500/700 ratio
      reasons.push("TRAINING_LOAD_HIGH");
    }
  } else if (totalTss > ACUTE_TSS_THRESHOLD) {
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

  // Use EWMA fatigue for readiness penalty when available and reliable,
  // so that decayed fatigue (rested after a hard block) actually improves
  // readiness — not just the display score.
  const effectiveFatigueNorm =
    ewma && !ewma.cold_start_fatigue ? ewma.fatigue_score / 100 : fatigueNorm;
  // Multiplicative penalty: high fatigue proportionally reduces readiness.
  // At fatigue=100: readiness = recovery * (1 - 0.6) = recovery * 0.4
  // At fatigue=50:  readiness = recovery * (1 - 0.3) = recovery * 0.7
  // At fatigue=0:   readiness = recovery * 1.0
  const fatiguePenalty = 1 - effectiveFatigueNorm * FATIGUE_PENALTY_STRENGTH;
  const readinessNorm = clamp01(avgRecovery * fatiguePenalty);
  let readiness_score = Math.round(readinessNorm * 100);

  // --- Fitness bonus (only when EWMA has enough data) ---
  if (ewma && !ewma.cold_start_fitness) {
    const fitnessBonus = Math.round(
      (ewma.fitness_score / 100) * FITNESS_READINESS_WEIGHT * 100,
    );
    readiness_score = clamp0100(readiness_score + fitnessBonus);
  }

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

  // --- Baseline mode detection (needed before trend states) ---
  let baseline_mode: BaselineMode | undefined;
  if (input.totalDataDays != null) {
    baseline_mode = detectBaselineMode(input.totalDataDays);
    if (baseline_mode === "cold_start" && !reasons.includes("COLD_START")) {
      reasons.push("COLD_START");
    }
  }

  // --- Structured trend states + legacy trend detection ---
  const hasTrendInputs =
    (input.hrvHistory && input.hrvHistory.length > 0) ||
    input.chronicLoad28d != null ||
    input.priorChronicLoad28d != null ||
    input.consecutiveTrainingDays != null;

  let trend_states: TrendState[] | undefined;
  if (hasTrendInputs) {
    const hrvBaseline = hrv?.hrv_baseline ?? null;
    trend_states = computeTrendStates(
      input.hrvHistory ?? null,
      hrvBaseline,
      input.chronicLoad28d ?? null,
      input.priorChronicLoad28d ?? null,
      input.consecutiveTrainingDays ?? null,
      baseline_mode ?? null,
    );

    // Extract reason codes from trend states
    for (const ts of trend_states) {
      if (ts.reason_code && !reasons.includes(ts.reason_code)) {
        reasons.push(ts.reason_code);
      }
    }
  }

  // --- Legacy trend detection for HRV (backward compat when no trend_states) ---
  // Use single-shot detectHrvDeclining with baseline for trivial-band gating
  if (input.hrvHistory && !trend_states) {
    const hrvCode = detectHrvDeclining(input.hrvHistory, hrv?.hrv_baseline ?? null);
    if (hrvCode && !reasons.includes(hrvCode)) {
      reasons.push(hrvCode);
    }
  }
  // When trend_states is present but HRV wasn't included (< 4 entries),
  // fall back to single-shot detection
  if (input.hrvHistory && trend_states && !trend_states.find((s) => s.metric === "hrv")) {
    const hrvCode = detectHrvDeclining(input.hrvHistory, hrv?.hrv_baseline ?? null);
    if (hrvCode && !reasons.includes(hrvCode)) {
      reasons.push(hrvCode);
    }
  }

  // --- Legacy trend detection for load/streak (when not covered by trend_states) ---
  if (!trend_states) {
    if (input.chronicLoad28d != null || input.priorChronicLoad28d != null) {
      const loadCode = detectTrainingLoadLow(
        input.chronicLoad28d ?? null,
        input.priorChronicLoad28d ?? null,
      );
      if (loadCode && !reasons.includes(loadCode)) {
        reasons.push(loadCode);
      }
    }

    if (input.consecutiveTrainingDays != null) {
      const streakCode = detectStreakRisk(input.consecutiveTrainingDays);
      if (streakCode && !reasons.includes(streakCode)) {
        reasons.push(streakCode);
      }
    }

    // Adaptation phase
    if (input.chronicLoad28d != null && input.priorChronicLoad28d != null) {
      const adaptCode = detectAdaptationPhase(
        input.chronicLoad28d,
        input.priorChronicLoad28d,
        baseline_mode ?? null,
      );
      if (adaptCode && !reasons.includes(adaptCode)) {
        reasons.push(adaptCode);
      }
    }
  }

  // --- Load surplus reason codes (from compliance layer) ---
  if (input.loadSurplus) {
    if (input.loadSurplus.has_unplanned_load && !reasons.includes("UNPLANNED_LOAD_HIGH")) {
      reasons.push("UNPLANNED_LOAD_HIGH");
    }
    if (input.loadSurplus.cross_sport_tss > 30 && !reasons.includes("CROSS_SPORT_LOAD")) {
      reasons.push("CROSS_SPORT_LOAD");
    }
  }

  // --- Confidence scoring (when enough context is available) ---
  let confidence: ConfidenceBreakdown | undefined;
  if (input.totalDataDays != null || input.latestDataTimestamp != null) {
    const mode = baseline_mode ?? "building";
    // Pass quality scores (0-1) when validity is available, else boolean presence
    const dataAvailability = computeDataAvailability(
      validity.sleep ? validity.sleep.quality : false,
      validity.hrv ? validity.hrv.quality : false,
      validity.metrics ? validity.metrics.quality : false,
      validity.load ? validity.load.quality : trainingLoad7Days.length > 0,
    );
    const signalConsistency = computeSignalConsistency(signals);
    const dataRecency = input.latestDataTimestamp
      ? computeDataRecency(
          input.latestDataTimestamp,
          input.currentTimestamp ?? new Date().toISOString(),
        )
      : 0.5; // neutral when no timestamp

    confidence = computeCompositeConfidence(
      {
        data_availability: dataAvailability,
        signal_consistency: signalConsistency,
        data_recency: dataRecency,
      },
      mode,
    );
  }

  // --- Confidence dampening: bias toward neutral with low confidence ---
  // With confidence 1.0: scores unchanged.
  // With confidence 0.3: scores blend 70% toward 50 (neutral).
  // This prevents extreme recommendations when data quality is poor.
  if (confidence) {
    const c = confidence.overall;
    const NEUTRAL = 50;
    readiness_score = clamp0100(readiness_score * c + NEUTRAL * (1 - c));
    fatigue_score = clamp0100(fatigue_score * c + NEUTRAL * (1 - c));
  }

  // --- Guarantee non-empty reason_codes ---
  if (reasons.length === 0) {
    reasons.push("RECOVERY_OPTIMAL");
  }

  // --- Build signal_validity for output (only when any signal present) ---
  const signal_validity: SignalValidityReport | undefined =
    hasAnySignal ? validity : undefined;

  return {
    readiness_score,
    fatigue_score,
    reason_codes: reasons,
    ...(confidence !== undefined && { confidence }),
    ...(baseline_mode !== undefined && { baseline_mode }),
    ...(ewma !== undefined && { ewma }),
    ...(signal_validity !== undefined && { signal_validity }),
    ...(trend_states !== undefined && { trend_states }),
  };
}
