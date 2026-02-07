/**
 * Pure, deterministic daily-recommendation engine.
 * No IO — all data arrives via the input parameter.
 */

// ---------------------------------------------------------------------------
// Input types (match the DB column selects in the cron handler)
// ---------------------------------------------------------------------------

export interface SleepSessionInput {
  date: string;
  duration_seconds: number;
  sleep_score: number;
  deep_seconds: number;
  rem_seconds: number;
  avg_hrv_ms: number;
}

export interface HrvNightInput {
  date: string;
  hrv_rmssd: number;
  hrv_baseline: number;
  hrv_status: string;
  weekly_avg: number;
}

export interface DailyMetricsInput {
  date: string;
  recovery_score: number;
  body_battery_high: number;
  body_battery_low: number;
  resting_heart_rate: number;
  stress_avg: number;
}

export interface TrainingLoadInput {
  date: string;
  workouts_count: number;
  total_duration_seconds: number;
  total_tss: number;
}

export interface ComputeRecommendationInput {
  userId: string;
  date: string;
  sleep: SleepSessionInput | null;
  hrv: HrvNightInput | null;
  metrics: DailyMetricsInput | null;
  trainingLoad7Days: TrainingLoadInput[];
}

// ---------------------------------------------------------------------------
// Output type (matches the columns upserted by the cron handler)
// ---------------------------------------------------------------------------

export interface ComputeRecommendationOutput {
  /** e.g. "train_hard", "train_easy", "active_recovery", "rest" */
  decision: string;
  /** Optional workout reference (null for rest / active-recovery) */
  workout_ref: string | null;
  /** 0-1 confidence score */
  confidence: number;
  /** Human-readable explanation */
  rationale: string;
  /** Structured evidence blob stored alongside the recommendation */
  evidence: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Scoring helpers (all pure)
// ---------------------------------------------------------------------------

/** Clamp value between 0 and 1. */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Recovery signal from sleep data (0 = poor, 1 = excellent).
 * sleep_score is expected 0-100.
 */
function sleepRecovery(s: SleepSessionInput): number {
  const scoreNorm = clamp01(s.sleep_score / 100);
  // 7-9 h ideal → penalty outside that range
  const hoursSlept = s.duration_seconds / 3600;
  const durationNorm = clamp01(1 - Math.abs(hoursSlept - 8) / 4);
  return 0.6 * scoreNorm + 0.4 * durationNorm;
}

/**
 * Recovery signal from HRV data (0 = suppressed, 1 = above baseline).
 */
function hrvRecovery(h: HrvNightInput): number {
  if (h.hrv_baseline <= 0) return 0.5; // can't compute ratio
  return clamp01(h.hrv_rmssd / h.hrv_baseline);
}

/**
 * Recovery signal from daily metrics (0 = poor, 1 = excellent).
 * recovery_score is expected 0-100.
 */
function metricsRecovery(m: DailyMetricsInput): number {
  return clamp01(m.recovery_score / 100);
}

/**
 * 7-day training-load fatigue signal (0 = fresh, 1 = heavily loaded).
 * Uses total TSS — 700+ weekly TSS ≈ very high load for most athletes.
 */
function loadFatigue(loads: TrainingLoadInput[]): number {
  const totalTss = loads.reduce((sum, l) => sum + l.total_tss, 0);
  return clamp01(totalTss / 700);
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export function computeDailyRecommendation(
  input: ComputeRecommendationInput,
): ComputeRecommendationOutput {
  const { sleep, hrv, metrics, trainingLoad7Days } = input;

  // Cold-start: no data at all → conservative rest recommendation
  if (!sleep && !hrv && !metrics && trainingLoad7Days.length === 0) {
    return {
      decision: "rest",
      workout_ref: null,
      confidence: 0.2,
      rationale: "Insufficient data to generate a recommendation — defaulting to rest.",
      evidence: { reason: "cold_start" },
    };
  }

  // Collect available signals
  const signals: number[] = [];
  const evidenceBlob: Record<string, unknown> = {};

  if (sleep) {
    const sr = sleepRecovery(sleep);
    signals.push(sr);
    evidenceBlob.sleep_recovery = +sr.toFixed(2);
    evidenceBlob.sleep_score = sleep.sleep_score;
  }
  if (hrv) {
    const hr = hrvRecovery(hrv);
    signals.push(hr);
    evidenceBlob.hrv_recovery = +hr.toFixed(2);
    evidenceBlob.hrv_rmssd = hrv.hrv_rmssd;
    evidenceBlob.hrv_baseline = hrv.hrv_baseline;
    evidenceBlob.hrv_status = hrv.hrv_status;
  }
  if (metrics) {
    const mr = metricsRecovery(metrics);
    signals.push(mr);
    evidenceBlob.metrics_recovery = +mr.toFixed(2);
    evidenceBlob.recovery_score = metrics.recovery_score;
  }

  const fatigue = loadFatigue(trainingLoad7Days);
  evidenceBlob.load_fatigue = +fatigue.toFixed(2);
  evidenceBlob.training_days_7d = trainingLoad7Days.length;

  // Average recovery (empty → 0.5 neutral)
  const avgRecovery =
    signals.length > 0
      ? signals.reduce((a, b) => a + b, 0) / signals.length
      : 0.5;

  // Combined readiness = recovery biased down by fatigue
  const readiness = clamp01(avgRecovery - fatigue * 0.3);
  evidenceBlob.avg_recovery = +avgRecovery.toFixed(2);
  evidenceBlob.readiness = +readiness.toFixed(2);

  // Confidence scales with how many data sources we have (max 4)
  const dataCount =
    (sleep ? 1 : 0) +
    (hrv ? 1 : 0) +
    (metrics ? 1 : 0) +
    (trainingLoad7Days.length > 0 ? 1 : 0);
  const confidence = clamp01(0.3 + dataCount * 0.175);

  // Decision thresholds
  let decision: string;
  let rationale: string;
  let workoutRef: string | null = null;

  if (readiness >= 0.75) {
    decision = "train_hard";
    workoutRef = "scheduled";
    rationale = "Recovery signals are strong — you're ready for a full session.";
  } else if (readiness >= 0.5) {
    decision = "train_easy";
    workoutRef = "lite_alternative";
    rationale = "Moderate recovery — an easy or reduced session is recommended.";
  } else if (readiness >= 0.3) {
    decision = "active_recovery";
    workoutRef = null;
    rationale = "Recovery is below average — light movement only (walk, stretch).";
  } else {
    decision = "rest";
    workoutRef = null;
    rationale = "Recovery signals are low — a full rest day is advised.";
  }

  return {
    decision,
    workout_ref: workoutRef,
    confidence: +confidence.toFixed(2),
    rationale,
    evidence: evidenceBlob,
  };
}
