/**
 * Pure, deterministic session calibrator.
 * No IO — all data arrives via the input parameter.
 *
 * Takes morning check-in data, wearable signals, and a planned session,
 * then produces a calibration result: traffic-light level, multipliers,
 * swap suggestion, headline, rationale, and applied rules.
 */

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

export type Mood5 = "drained" | "tired" | "okay" | "good" | "great";
export type WearableReadiness = "red" | "yellow" | "green";
export type ReasonBucket = "sick" | "hurt" | "fried" | "none";
export type CalibrationLevel = "red" | "amber" | "green" | "upgrade";

export type SwapSuggestion =
  | "rest"
  | "recovery"
  | "easy"
  | "mobility"
  | "cross_train"
  | "injury_safe"
  | "as_planned"
  | "harder_variant";

export type UpgradeType = "intensity" | "volume";

/** Morning check-in subjective fields. */
export interface CheckinInput {
  mood: Mood5;
  rpe?: number | null;
  soreness?: number | null;
  pain_flag?: boolean | null;
  illness_flag?: boolean | null;
  reason_bucket?: ReasonBucket | null;
  pain_severity?: number | null;
  pain_locations?: string[] | null;
  sleep_quality?: number | null;
  perceived_energy?: number | null;
  motivation?: number | null;
  life_stress?: number | null;
  time_constraint_minutes?: number | null;
  /** Great mood: user preference for upgrade direction. */
  upgrade_type?: UpgradeType | null;
}

/** Minimal planned session shape. */
export interface PlannedSessionInput {
  planned_duration_minutes?: number | null;
  planned_intensity?: number | null;
}

/** Wearable readiness signals. */
export interface WearableSignalsInput {
  readiness: WearableReadiness;
  readiness_score?: number | null;
  fatigue_score?: number | null;
}

/** Combined calibrator input. */
export interface CalibratorInput {
  planned_session: PlannedSessionInput | null;
  wearable_signals: WearableSignalsInput | null;
  morning_checkin: CheckinInput | null;
}

/** Calibration output. */
export interface CalibrationResult {
  level: CalibrationLevel;
  intensity_multiplier: number;
  duration_multiplier: number;
  swap_to: SwapSuggestion;
  headline: string;
  rationale: string;
  applied_rules: string[];
  warnings: string[];
  checkin_readiness_delta: number;
  checkin_fatigue_delta: number;
}

// ---------------------------------------------------------------------------
// Constants — must match SSOT deltas
// ---------------------------------------------------------------------------

/** Additive readiness/fatigue deltas per mood value. */
const MOOD_DELTAS: Record<Mood5, { readiness: number; fatigue: number }> = {
  drained: { readiness: -15, fatigue: 15 },
  tired: { readiness: -8, fatigue: 8 },
  okay: { readiness: 0, fatigue: 0 },
  good: { readiness: 5, fatigue: -5 },
  great: { readiness: 5, fatigue: -5 },
};

const RPE_HIGH_THRESHOLD = 8;
const RPE_HIGH_FATIGUE_DELTA = 8;

const SORENESS_HIGH_THRESHOLD = 7;
const SORENESS_HIGH_FATIGUE_DELTA = 8;

const PAIN_READINESS_DELTA = -15;
const PAIN_FATIGUE_DELTA = 12;

const ILLNESS_READINESS_DELTA = -20;
const ILLNESS_FATIGUE_DELTA = 15;

/** Hard-stop pain severity threshold. */
const PAIN_SEVERITY_HARD_STOP = 7;

/** Hard-stop fatigue score threshold (from wearable). */
const FATIGUE_HARD_STOP = 85;

/** Multiplier clamp ranges. */
const INTENSITY_MIN = 0.5;
const INTENSITY_MAX = 1.15;
const DURATION_MIN = 0.5;
const DURATION_MAX = 1.05;

/**
 * Subjective 1-5 scale deltas.
 * Scales: sleep_quality, perceived_energy, motivation, life_stress.
 * Value 3 is neutral (no adjustment). Lower values penalize, higher values give small boost.
 * life_stress is inverted: higher stress = worse readiness.
 */
const SCALE_DELTAS: Record<number, { readiness: number; fatigue: number }> = {
  1: { readiness: -8, fatigue: 6 },
  2: { readiness: -4, fatigue: 3 },
  3: { readiness: 0, fatigue: 0 },
  4: { readiness: 2, fatigue: -1 },
  5: { readiness: 4, fatigue: -2 },
};

/** life_stress is inverted: 5 = very stressed = bad. */
const STRESS_SCALE_DELTAS: Record<number, { readiness: number; fatigue: number }> = {
  1: { readiness: 4, fatigue: -2 },
  2: { readiness: 2, fatigue: -1 },
  3: { readiness: 0, fatigue: 0 },
  4: { readiness: -4, fatigue: 3 },
  5: { readiness: -8, fatigue: 6 },
};

/** Intensity cap when any scale is critically low (1). */
const SCALE_CRITICAL_INTENSITY_CAP = 0.85;
/** Intensity cap when any scale is low (2). */
const SCALE_LOW_INTENSITY_CAP = 0.92;

// ---------------------------------------------------------------------------
// Pain location classification
// ---------------------------------------------------------------------------

const LOWER_BODY_LOCATIONS = new Set(["foot_ankle", "knee", "hip_glute"]);
const BACK_LOCATIONS = new Set(["back"]);
const UPPER_BODY_LOCATIONS = new Set(["shoulder"]);

interface PainLocationAnalysis {
  has_lower_body: boolean;
  has_back: boolean;
  has_upper_body: boolean;
  preferred_swap: SwapSuggestion;
  warnings: string[];
  rules: string[];
}

/**
 * Analyze pain locations to produce location-specific swap suggestions and warnings.
 * Pure function — no IO.
 */
function analyzePainLocations(locations: string[]): PainLocationAnalysis {
  const has_lower_body = locations.some((l) => LOWER_BODY_LOCATIONS.has(l));
  const has_back = locations.some((l) => BACK_LOCATIONS.has(l));
  const has_upper_body = locations.some((l) => UPPER_BODY_LOCATIONS.has(l));

  const warnings: string[] = [];
  const rules: string[] = [];

  if (has_lower_body) {
    warnings.push("Lower body pain — avoid high-impact activities (running, jumping)");
    rules.push("PAIN_LOWER_BODY");
  }
  if (has_back) {
    warnings.push("Back pain — avoid heavy loading and high-impact movement");
    rules.push("PAIN_BACK");
  }
  if (has_upper_body) {
    warnings.push("Upper body pain — avoid overhead and pulling movements");
    rules.push("PAIN_UPPER_BODY");
  }

  // Determine preferred swap based on affected regions
  let preferred_swap: SwapSuggestion = "injury_safe";
  if (has_lower_body && has_back) {
    // Multi-region including lower body + back → mobility only
    preferred_swap = "mobility";
  } else if (has_lower_body) {
    // Lower body → cross-train (cycling, swimming, upper body work)
    preferred_swap = "cross_train";
  } else if (has_back) {
    // Back → mobility/gentle movement
    preferred_swap = "mobility";
  } else if (has_upper_body) {
    // Upper body only → lower body cardio is fine
    preferred_swap = "easy";
  }

  return { has_lower_body, has_back, has_upper_body, preferred_swap, warnings, rules };
}

// ---------------------------------------------------------------------------
// Exported delta computation (testable independently)
// ---------------------------------------------------------------------------

export interface CheckinDeltas {
  readiness_delta: number;
  fatigue_delta: number;
}

/**
 * Compute additive readiness/fatigue deltas from check-in fields only.
 * Pure function — no side effects.
 */
export function computeCheckinDeltas(checkin: CheckinInput): CheckinDeltas {
  let readiness_delta = 0;
  let fatigue_delta = 0;

  // Mood
  const moodAdj = MOOD_DELTAS[checkin.mood];
  readiness_delta += moodAdj.readiness;
  fatigue_delta += moodAdj.fatigue;

  // RPE
  if (checkin.rpe != null && checkin.rpe >= RPE_HIGH_THRESHOLD) {
    fatigue_delta += RPE_HIGH_FATIGUE_DELTA;
  }

  // Soreness
  if (checkin.soreness != null && checkin.soreness >= SORENESS_HIGH_THRESHOLD) {
    fatigue_delta += SORENESS_HIGH_FATIGUE_DELTA;
  }

  // Pain flag
  if (checkin.pain_flag) {
    readiness_delta += PAIN_READINESS_DELTA;
    fatigue_delta += PAIN_FATIGUE_DELTA;
  }

  // Illness flag
  if (checkin.illness_flag) {
    readiness_delta += ILLNESS_READINESS_DELTA;
    fatigue_delta += ILLNESS_FATIGUE_DELTA;
  }

  // Subjective scales (1-5)
  if (checkin.sleep_quality != null && SCALE_DELTAS[checkin.sleep_quality]) {
    const d = SCALE_DELTAS[checkin.sleep_quality];
    readiness_delta += d.readiness;
    fatigue_delta += d.fatigue;
  }

  if (checkin.perceived_energy != null && SCALE_DELTAS[checkin.perceived_energy]) {
    const d = SCALE_DELTAS[checkin.perceived_energy];
    readiness_delta += d.readiness;
    fatigue_delta += d.fatigue;
  }

  if (checkin.motivation != null && SCALE_DELTAS[checkin.motivation]) {
    const d = SCALE_DELTAS[checkin.motivation];
    readiness_delta += d.readiness;
    fatigue_delta += d.fatigue;
  }

  // life_stress uses inverted scale (higher = worse)
  if (checkin.life_stress != null && STRESS_SCALE_DELTAS[checkin.life_stress]) {
    const d = STRESS_SCALE_DELTAS[checkin.life_stress];
    readiness_delta += d.readiness;
    fatigue_delta += d.fatigue;
  }

  return { readiness_delta, fatigue_delta };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isHardStop(checkin: CheckinInput | null, fatigue_score: number | null): {
  triggered: boolean;
  cause: string | null;
} {
  if (checkin?.illness_flag) {
    return { triggered: true, cause: "ILLNESS_FLAG" };
  }
  if (checkin?.reason_bucket === "sick") {
    return { triggered: true, cause: "REASON_SICK" };
  }
  if (
    checkin?.reason_bucket === "hurt" &&
    checkin.pain_severity != null &&
    checkin.pain_severity >= PAIN_SEVERITY_HARD_STOP
  ) {
    return { triggered: true, cause: "SEVERE_PAIN" };
  }
  if (fatigue_score != null && fatigue_score >= FATIGUE_HARD_STOP) {
    return { triggered: true, cause: "FATIGUE_EXTREME" };
  }
  return { triggered: false, cause: null };
}

function swapForHardStop(cause: string): SwapSuggestion {
  switch (cause) {
    case "ILLNESS_FLAG":
    case "REASON_SICK":
      return "rest";
    case "SEVERE_PAIN":
      return "injury_safe";
    case "FATIGUE_EXTREME":
      return "mobility";
    default:
      return "rest";
  }
}

function headlineForHardStop(cause: string): string {
  switch (cause) {
    case "ILLNESS_FLAG":
    case "REASON_SICK":
      return "Rest recommended — illness detected";
    case "SEVERE_PAIN":
      return "Injury protocol — reduce to safe movement only";
    case "FATIGUE_EXTREME":
      return "Recovery day — extreme fatigue detected";
    default:
      return "Rest recommended — safety override active";
  }
}

function rationaleForHardStop(cause: string): string {
  switch (cause) {
    case "ILLNESS_FLAG":
    case "REASON_SICK":
      return "Training while sick delays recovery and risks worsening symptoms. Rest is the fastest path back.";
    case "SEVERE_PAIN":
      return "Pain severity is high. Only injury-safe movement is appropriate until pain subsides.";
    case "FATIGUE_EXTREME":
      return "Wearable data shows extreme fatigue accumulation. Light mobility will aid recovery without adding load.";
    default:
      return "A safety override has been triggered. Prioritize recovery today.";
  }
}

// ---------------------------------------------------------------------------
// Main calibration function
// ---------------------------------------------------------------------------

/**
 * Calibrate a planned session based on morning check-in, wearable signals,
 * and session details. Returns a fully deterministic calibration result.
 */
export function calibrateSession(input: CalibratorInput): CalibrationResult {
  const { planned_session, wearable_signals, morning_checkin } = input;
  const applied_rules: string[] = [];
  const warnings: string[] = [];

  // Compute check-in deltas
  let checkin_readiness_delta = 0;
  let checkin_fatigue_delta = 0;
  if (morning_checkin) {
    const deltas = computeCheckinDeltas(morning_checkin);
    checkin_readiness_delta = deltas.readiness_delta;
    checkin_fatigue_delta = deltas.fatigue_delta;
    applied_rules.push("CHECKIN_DELTAS_APPLIED");
  }

  const wearableFatigue = wearable_signals?.fatigue_score ?? null;
  const wearableReadiness = wearable_signals?.readiness ?? null;

  // --- Hard-stop check (safety overrides) ---
  const hardStop = isHardStop(morning_checkin, wearableFatigue);
  if (hardStop.triggered) {
    const cause = hardStop.cause!;
    applied_rules.push(`HARD_STOP:${cause}`);
    warnings.push(`Safety override: ${cause}`);

    let hardStopSwap = swapForHardStop(cause);

    // Refine swap for severe pain based on pain locations
    if (cause === "SEVERE_PAIN" && morning_checkin?.pain_locations?.length) {
      const locAnalysis = analyzePainLocations(morning_checkin.pain_locations);
      hardStopSwap = locAnalysis.preferred_swap;
      warnings.push(...locAnalysis.warnings);
      applied_rules.push(...locAnalysis.rules);
    }

    return {
      level: "red",
      intensity_multiplier: 0.65,
      duration_multiplier: 0.65,
      swap_to: hardStopSwap,
      headline: headlineForHardStop(cause),
      rationale: rationaleForHardStop(cause),
      applied_rules,
      warnings,
      checkin_readiness_delta,
      checkin_fatigue_delta,
    };
  }

  // --- Determine base calibration level from mood ---
  let level: CalibrationLevel;
  let intensity_multiplier: number;
  let duration_multiplier: number;
  let swap_to: SwapSuggestion;
  let headline: string;
  let rationale: string;

  const mood = morning_checkin?.mood ?? null;

  if (mood === "drained") {
    level = "red";
    intensity_multiplier = 0.70;
    duration_multiplier = 0.75;
    swap_to = "recovery";
    headline = "Take it easy — you're feeling drained";
    rationale = "Your subjective report indicates significant fatigue. A recovery session preserves training consistency without adding harmful load.";

    // Check reason_bucket for more specific swap
    if (morning_checkin?.reason_bucket === "fried") {
      swap_to = "easy";
      applied_rules.push("REASON_FRIED");
    } else if (morning_checkin?.reason_bucket === "hurt") {
      swap_to = "injury_safe";
      applied_rules.push("REASON_HURT_MODERATE");
      warnings.push("Pain reported — injury-aware session recommended");
    } else if (morning_checkin?.reason_bucket === "none") {
      applied_rules.push("REASON_NONE_DRAINED");
    }
    applied_rules.push("MOOD_DRAINED");
  } else if (mood === "tired") {
    level = "amber";
    intensity_multiplier = 0.85;
    duration_multiplier = 0.90;
    swap_to = "easy";
    headline = "Modified session — fatigue noted";
    rationale = "You reported feeling tired. Reducing intensity keeps you on track without overreaching.";
    applied_rules.push("MOOD_TIRED");
  } else if (mood === "okay") {
    level = "amber";
    intensity_multiplier = 0.95;
    duration_multiplier = 0.95;
    swap_to = "as_planned";
    headline = "Proceed with slight caution";
    rationale = "You feel okay — proceed as planned with a small buffer for accumulated fatigue.";
    applied_rules.push("MOOD_OKAY");
  } else if (mood === "great") {
    // Upgrade path — gated by wearable readiness
    const upgradeType = morning_checkin?.upgrade_type ?? null;

    if (wearableReadiness === "green") {
      level = "upgrade";
      swap_to = "harder_variant";

      if (upgradeType === "intensity") {
        intensity_multiplier = 1.10;
        duration_multiplier = 1.00;
        headline = "Green light — intensity focus";
        rationale = "You feel great and wearable data confirms readiness. Pushing intensity with standard duration.";
        applied_rules.push("MOOD_GREAT", "WEARABLE_GREEN_UPGRADE", "UPGRADE_INTENSITY");
      } else if (upgradeType === "volume") {
        intensity_multiplier = 1.00;
        duration_multiplier = 1.05;
        headline = "Green light — volume focus";
        rationale = "You feel great and wearable data confirms readiness. Extending duration at standard intensity.";
        applied_rules.push("MOOD_GREAT", "WEARABLE_GREEN_UPGRADE", "UPGRADE_VOLUME");
      } else {
        intensity_multiplier = 1.10;
        duration_multiplier = 1.05;
        headline = "Green light — push today";
        rationale = "You feel great and wearable data confirms readiness. A slight progression is safe today.";
        applied_rules.push("MOOD_GREAT", "WEARABLE_GREEN_UPGRADE");
      }
    } else if (wearableReadiness === "yellow") {
      level = "green";
      swap_to = "as_planned";

      if (upgradeType === "intensity") {
        intensity_multiplier = 1.05;
        duration_multiplier = 1.00;
        headline = "Mild caution — intensity capped";
        rationale = "You feel great but wearable data shows moderate recovery. Intensity bump capped at 5%.";
        applied_rules.push("MOOD_GREAT", "WEARABLE_YELLOW_CAP", "UPGRADE_INTENSITY");
      } else if (upgradeType === "volume") {
        intensity_multiplier = 1.00;
        duration_multiplier = 1.05;
        headline = "Mild caution — volume capped";
        rationale = "You feel great but wearable data shows moderate recovery. Duration extension capped at 5%.";
        applied_rules.push("MOOD_GREAT", "WEARABLE_YELLOW_CAP", "UPGRADE_VOLUME");
      } else {
        intensity_multiplier = 1.05;
        duration_multiplier = 1.00;
        headline = "Good to go — mild caution from wearable";
        rationale = "You feel great but wearable data shows moderate recovery. Proceed with a small progression cap.";
        applied_rules.push("MOOD_GREAT", "WEARABLE_YELLOW_CAP");
      }
      warnings.push("Wearable readiness yellow — upgrade capped");
    } else if (wearableReadiness === "red") {
      level = "green";
      intensity_multiplier = 1.00;
      duration_multiplier = 1.00;
      swap_to = "as_planned";
      headline = "Proceed as planned — wearable caution";
      rationale = "You feel great but wearable data flags low recovery. No upgrade today; proceed at baseline.";
      applied_rules.push("MOOD_GREAT", "WEARABLE_RED_CONSTRAIN");
      if (upgradeType) {
        applied_rules.push("UPGRADE_BLOCKED_WEARABLE");
        warnings.push(`Upgrade preference (${upgradeType}) blocked — wearable readiness red`);
      } else {
        warnings.push("Wearable readiness red — no upgrade despite great mood");
      }
    } else {
      // No wearable data
      level = "green";
      intensity_multiplier = 1.00;
      duration_multiplier = 1.00;
      swap_to = "as_planned";
      headline = "Good to go";
      rationale = "You feel great. Without wearable confirmation, proceed at planned intensity.";
      applied_rules.push("MOOD_GREAT", "NO_WEARABLE_DATA");
      if (upgradeType) {
        applied_rules.push("UPGRADE_DEFERRED_NO_WEARABLE");
      }
    }
  } else if (mood === "good") {
    level = "green";
    intensity_multiplier = 1.00;
    duration_multiplier = 1.00;
    swap_to = "as_planned";
    headline = "All clear — train as planned";
    rationale = "You feel good and there are no flags. Execute your planned session.";
    applied_rules.push("MOOD_GOOD");
  } else {
    // No check-in provided — fall back to wearable signals
    if (wearableReadiness === "red") {
      level = "amber";
      intensity_multiplier = 0.85;
      duration_multiplier = 0.90;
      swap_to = "easy";
      headline = "Caution — wearable signals low";
      rationale = "No check-in submitted. Wearable data indicates low recovery — reduce intensity as a precaution.";
      applied_rules.push("NO_CHECKIN", "WEARABLE_RED_FALLBACK");
      warnings.push("No check-in — relying on wearable data");
    } else if (wearableReadiness === "yellow") {
      level = "amber";
      intensity_multiplier = 0.95;
      duration_multiplier = 0.95;
      swap_to = "as_planned";
      headline = "Proceed with caution";
      rationale = "No check-in submitted. Wearable data shows moderate recovery.";
      applied_rules.push("NO_CHECKIN", "WEARABLE_YELLOW_FALLBACK");
      warnings.push("No check-in — relying on wearable data");
    } else {
      // Green wearable or no wearable at all
      level = "green";
      intensity_multiplier = 1.00;
      duration_multiplier = 1.00;
      swap_to = "as_planned";
      headline = "Train as planned";
      rationale = wearableReadiness === "green"
        ? "No check-in submitted. Wearable readiness is green — proceed normally."
        : "No check-in or wearable data. Defaulting to planned session.";
      applied_rules.push("NO_CHECKIN", wearableReadiness === "green" ? "WEARABLE_GREEN_DEFAULT" : "NO_WEARABLE_DATA");
    }
  }

  // --- Elevated fatigue adjustments (from check-in deltas) ---
  if (morning_checkin) {
    if (
      morning_checkin.rpe != null &&
      morning_checkin.rpe >= RPE_HIGH_THRESHOLD &&
      mood !== "drained"
    ) {
      intensity_multiplier = Math.min(intensity_multiplier, 0.90);
      applied_rules.push("RPE_HIGH_REDUCTION");
    }

    if (
      morning_checkin.soreness != null &&
      morning_checkin.soreness >= SORENESS_HIGH_THRESHOLD &&
      mood !== "drained"
    ) {
      intensity_multiplier = Math.min(intensity_multiplier, 0.90);
      applied_rules.push("SORENESS_HIGH_REDUCTION");
    }

    // Moderate pain (hurt but not hard-stop severity)
    if (
      morning_checkin.reason_bucket === "hurt" &&
      (morning_checkin.pain_severity == null || morning_checkin.pain_severity < PAIN_SEVERITY_HARD_STOP)
    ) {
      if (mood !== "drained") {
        warnings.push("Moderate pain reported — consider injury-aware modifications");
        applied_rules.push("MODERATE_PAIN_WARNING");

        // Location-specific refinements
        if (morning_checkin.pain_locations?.length) {
          const locAnalysis = analyzePainLocations(morning_checkin.pain_locations);
          warnings.push(...locAnalysis.warnings);
          applied_rules.push(...locAnalysis.rules);

          // For moderate pain with lower body involvement, cap intensity further
          if (locAnalysis.has_lower_body) {
            intensity_multiplier = Math.min(intensity_multiplier, 0.85);
            applied_rules.push("PAIN_LOWER_BODY_INTENSITY_CAP");
          }
          if (locAnalysis.has_back) {
            intensity_multiplier = Math.min(intensity_multiplier, 0.85);
            applied_rules.push("PAIN_BACK_INTENSITY_CAP");
          }
        }
      }
    }

    // Subjective scale intensity caps (non-drained moods only)
    // life_stress excluded: its inverted scale means low values = good (no cap needed)
    if (mood !== "drained") {
      const scales = [
        { name: "SLEEP", value: morning_checkin.sleep_quality },
        { name: "ENERGY", value: morning_checkin.perceived_energy },
        { name: "MOTIVATION", value: morning_checkin.motivation },
      ];

      for (const s of scales) {
        if (s.value == null) continue;
        if (s.value <= 1) {
          intensity_multiplier = Math.min(intensity_multiplier, SCALE_CRITICAL_INTENSITY_CAP);
          applied_rules.push(`${s.name}_CRITICAL_REDUCTION`);
        } else if (s.value <= 2) {
          intensity_multiplier = Math.min(intensity_multiplier, SCALE_LOW_INTENSITY_CAP);
          applied_rules.push(`${s.name}_LOW_REDUCTION`);
        }
      }
    }
  }

  // --- Time constraint handling ---
  if (
    morning_checkin?.time_constraint_minutes != null &&
    morning_checkin.time_constraint_minutes > 0 &&
    planned_session?.planned_duration_minutes != null &&
    planned_session.planned_duration_minutes > 0
  ) {
    const timeRatio =
      morning_checkin.time_constraint_minutes / planned_session.planned_duration_minutes;
    if (timeRatio < duration_multiplier) {
      duration_multiplier = timeRatio;
      applied_rules.push("TIME_CONSTRAINT_APPLIED");
    }
  }

  // --- Final clamp ---
  intensity_multiplier = clamp(intensity_multiplier, INTENSITY_MIN, INTENSITY_MAX);
  duration_multiplier = clamp(duration_multiplier, DURATION_MIN, DURATION_MAX);

  return {
    level,
    intensity_multiplier,
    duration_multiplier,
    swap_to,
    headline,
    rationale,
    applied_rules,
    warnings,
    checkin_readiness_delta,
    checkin_fatigue_delta,
  };
}
