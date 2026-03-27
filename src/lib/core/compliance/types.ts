/**
 * Types for the compliance matching and load surplus detection layer.
 * Pure types only — no IO, no Supabase, no React dependencies.
 */

// ---------------------------------------------------------------------------
// Sport normalization
// ---------------------------------------------------------------------------

/** Normalized sport categories used across the compliance layer. */
export type NormalizedSport =
  | "running"
  | "cycling"
  | "swimming"
  | "strength"
  | "other";

// ---------------------------------------------------------------------------
// Compliance matching
// ---------------------------------------------------------------------------

/** Categorical match status derived from continuous match_score. */
export type MatchStatus = "completed" | "partial" | "substituted" | "missed";

/** Input for matching actual workouts against a single planned workout. */
export interface ComplianceMatchInput {
  planned: {
    sport: string | null;
    template_ref: string | null;
    duration_minutes: number | null;
    intensity_level: number | null;
    target_tss: number | null;
  };
  actuals: Array<{
    id: string;
    activity_type: string;
    activity_subtype: string | null;
    duration_seconds: number;
    training_stress_score: number | null;
    intensity_factor: number | null;
    source: string;
  }>;
}

/** Result of matching actual workouts to a planned workout. */
export interface ComplianceMatchResult {
  /** Continuous match quality (0.0 – 1.0). */
  match_score: number;
  /** Categorical status derived from match_score. */
  match_status: MatchStatus;
  /** workout.id of the best-matching actual workout, or null if missed. */
  best_match_id: string | null;
  /** Whether the best match is the same sport as planned. */
  sport_match: boolean;
  /** actual_duration / planned_duration (null if no duration data). */
  duration_ratio: number | null;
  /** actual_tss / planned_tss (null if no TSS data). */
  tss_ratio: number | null;
  /** IDs of actual workouts not matched to this planned workout. */
  unmatched_workout_ids: string[];
  /** Human-readable explanation of the match result. */
  reason: string;
}

// ---------------------------------------------------------------------------
// Load surplus
// ---------------------------------------------------------------------------

/** Per-workout source attribution entry. */
export interface SourceAttribution {
  id: string;
  source: string;
  sport: NormalizedSport;
  tss: number;
  is_planned: boolean;
}

/** Input for computing daily load surplus. */
export interface DailyLoadSurplusInput {
  /** Total TSS that was planned for the day. */
  planned_tss: number;
  /** Total actual TSS recorded for the day. */
  actual_tss: number;
  /** The sport of the planned workout (null if no plan). */
  planned_sport: NormalizedSport | null;
  /** Individual actual workouts for attribution. */
  actual_workouts: Array<{
    id: string;
    sport: NormalizedSport;
    tss: number;
    source: string;
  }>;
  /** IDs of workouts that were matched to planned workouts. */
  matched_workout_ids: string[];
}

/** Result of load surplus computation. */
export interface LoadSurplusResult {
  /** actual_tss - planned_tss (can be negative if under-delivered). */
  surplus_tss: number;
  /** actual_tss / planned_tss (Infinity if no plan but activity exists, 1.0 if both zero). */
  surplus_ratio: number;
  /** True when surplus_ratio > 1.5 (50% over plan). */
  has_unplanned_load: boolean;
  /** Total TSS from sports different than planned. */
  cross_sport_tss: number;
  /** Cross-sport TSS after applying transfer coefficients. */
  transferred_tss: number;
  /** Per-workout breakdown with is_planned flag. */
  source_attribution: SourceAttribution[];
}
