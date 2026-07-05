/**
 * Match actual completed workouts against a planned workout.
 *
 * Pure function — scores each actual workout against the planned one using
 * sport match, duration ratio, intensity/TSS ratio, and subtype bonus.
 * Returns the best match, its score, categorical status, and which actuals
 * were unmatched (i.e. unplanned).
 *
 * No IO, fully testable.
 */

import type { ComplianceMatchInput, ComplianceMatchResult, MatchStatus, NormalizedSport } from "./types.js";
import { normalizeSport } from "./normalizeSport.js";

// ---------------------------------------------------------------------------
// Scoring weights (must sum to 1.0)
// ---------------------------------------------------------------------------

/** Weight for sport match component. */
const W_SPORT = 0.30;
/** Weight for duration ratio component. */
const W_DURATION = 0.30;
/** Weight for intensity/TSS ratio component. */
const W_INTENSITY = 0.25;
/** Weight for subtype/template keyword bonus. */
const W_SUBTYPE = 0.15;

// ---------------------------------------------------------------------------
// Status thresholds
// ---------------------------------------------------------------------------

/** Score at or above which match_status = "completed". */
const COMPLETED_THRESHOLD = 0.70;
/** Score at or above which match_status = "partial". */
const PARTIAL_THRESHOLD = 0.30;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Symmetric ratio: min(a,b)/max(a,b). Returns 1.0 if both zero. */
function symmetricRatio(a: number, b: number): number {
  if (a === 0 && b === 0) return 1.0;
  const maxVal = Math.max(a, b);
  if (maxVal === 0) return 1.0;
  return Math.min(a, b) / maxVal;
}

/** Map continuous score to categorical status. */
function scoreToStatus(score: number): MatchStatus {
  if (score >= COMPLETED_THRESHOLD) return "completed";
  if (score >= PARTIAL_THRESHOLD) return "partial";
  if (score > 0) return "substituted";
  return "missed";
}

/** Normalize the planned sport field to our canonical form. */
function normalizePlannedSport(sport: string | null): NormalizedSport {
  if (!sport) return "other";
  // The planned_workouts.sport column may already be canonical ("running")
  // or a Garmin-style string. normalizeSport handles both.
  return normalizeSport(sport);
}

/** Extract intensity keywords from a template_ref like "tempo-run-45min". */
function extractTemplateKeywords(templateRef: string | null): string[] {
  if (!templateRef) return [];
  return templateRef.toLowerCase().split(/[-_\s]+/).filter(Boolean);
}

/** Check if the actual workout's subtype or activity_type contains any template keyword. */
function hasSubtypeMatch(
  activityType: string,
  activitySubtype: string | null,
  templateKeywords: string[],
): boolean {
  if (templateKeywords.length === 0) return false;
  const haystack = [activityType, activitySubtype ?? ""]
    .join(" ")
    .toLowerCase();

  // Match meaningful workout-type keywords, not generic words
  const meaningfulKeywords = [
    "tempo",
    "interval",
    "easy",
    "recovery",
    "long",
    "threshold",
    "speed",
    "hill",
    "fartlek",
    "strength",
    "mobility",
  ];
  return templateKeywords.some(
    (kw) => meaningfulKeywords.includes(kw) && haystack.includes(kw),
  );
}

// ---------------------------------------------------------------------------
// Scoring a single actual against the planned workout
// ---------------------------------------------------------------------------

interface SingleMatchScore {
  score: number;
  sportMatch: boolean;
  durationRatio: number | null;
  tssRatio: number | null;
}

function scoreActual(
  planned: ComplianceMatchInput["planned"],
  actual: ComplianceMatchInput["actuals"][number],
): SingleMatchScore {
  const plannedSport = normalizePlannedSport(planned.sport);
  const actualSport = normalizeSport(actual.activity_type);

  // 1. Sport match (binary: 0 or W_SPORT)
  const sportMatch = plannedSport === actualSport;
  const sportScore = sportMatch ? W_SPORT : 0;

  // 2. Duration ratio
  let durationRatio: number | null = null;
  let durationScore: number;
  if (planned.duration_minutes != null && planned.duration_minutes > 0) {
    const actualMinutes = actual.duration_seconds / 60;
    durationRatio = actualMinutes / planned.duration_minutes;
    durationScore = symmetricRatio(actualMinutes, planned.duration_minutes) * W_DURATION;
  } else {
    // No planned duration — give neutral score
    durationScore = W_DURATION * 0.5;
  }

  // 3. Intensity / TSS ratio
  let tssRatio: number | null = null;
  let intensityScore: number;
  if (
    planned.target_tss != null &&
    planned.target_tss > 0 &&
    actual.training_stress_score != null &&
    actual.training_stress_score > 0
  ) {
    tssRatio = actual.training_stress_score / planned.target_tss;
    intensityScore = symmetricRatio(actual.training_stress_score, planned.target_tss) * W_INTENSITY;
  } else if (
    planned.intensity_level != null &&
    actual.intensity_factor != null &&
    actual.intensity_factor > 0
  ) {
    // Rough comparison: intensity_level (1-10) vs intensity_factor (0.5-1.2 typically)
    // Normalize intensity_level to a comparable range: level/10 ≈ IF
    const plannedIf = planned.intensity_level / 10;
    intensityScore = symmetricRatio(actual.intensity_factor, plannedIf) * W_INTENSITY;
  } else {
    // No intensity data — neutral
    intensityScore = W_INTENSITY * 0.5;
  }

  // 4. Subtype / template keyword bonus
  const templateKeywords = extractTemplateKeywords(planned.template_ref);
  const subtypeMatch = hasSubtypeMatch(
    actual.activity_type,
    actual.activity_subtype,
    templateKeywords,
  );
  const subtypeScore = subtypeMatch ? W_SUBTYPE : 0;

  const totalScore = Math.min(
    sportScore + durationScore + intensityScore + subtypeScore,
    1.0,
  );

  return {
    score: Math.round(totalScore * 100) / 100, // 2 decimal places
    sportMatch,
    durationRatio,
    tssRatio,
  };
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Match actual workouts from a given date against a single planned workout.
 *
 * Scores each actual, picks the best match, and returns the result.
 * Unmatched actuals are reported as `unmatched_workout_ids` (potential
 * unplanned sessions).
 *
 * If `excludeIds` is provided, those workout IDs are skipped (already
 * claimed by a prior planned workout in multi-plan-per-day scenarios).
 */
export function matchWorkoutToPlanned(
  input: ComplianceMatchInput,
  excludeIds: Set<string> = new Set(),
): ComplianceMatchResult {
  const availableActuals = input.actuals.filter((a) => !excludeIds.has(a.id));

  // No actuals at all → missed
  if (availableActuals.length === 0) {
    return {
      match_score: 0,
      match_status: "missed",
      best_match_id: null,
      sport_match: false,
      duration_ratio: null,
      tss_ratio: null,
      unmatched_workout_ids: [],
      reason: "No workouts recorded on this date.",
    };
  }

  // Score each available actual
  let bestScore: SingleMatchScore = { score: 0, sportMatch: false, durationRatio: null, tssRatio: null };
  let bestIdx = -1;

  for (let i = 0; i < availableActuals.length; i++) {
    const s = scoreActual(input.planned, availableActuals[i]);
    if (s.score > bestScore.score) {
      bestScore = s;
      bestIdx = i;
    }
  }

  const bestMatch = bestIdx >= 0 ? availableActuals[bestIdx] : null;
  const matchStatus = scoreToStatus(bestScore.score);

  // All actuals except the best match are unmatched
  const unmatchedIds = availableActuals
    .filter((_, i) => i !== bestIdx)
    .map((a) => a.id);

  // Build reason string
  const reason = buildReason(matchStatus, bestScore, input.planned, bestMatch);

  return {
    match_score: bestScore.score,
    match_status: matchStatus,
    best_match_id: bestMatch?.id ?? null,
    sport_match: bestScore.sportMatch,
    duration_ratio: bestScore.durationRatio,
    tss_ratio: bestScore.tssRatio,
    unmatched_workout_ids: unmatchedIds,
    reason,
  };
}

// ---------------------------------------------------------------------------
// Multi-plan matching
// ---------------------------------------------------------------------------

/**
 * Match multiple planned workouts on the same date against the pool of actuals.
 * Uses greedy assignment: highest-scoring match wins, then its actual is removed
 * from the pool for subsequent planned workouts.
 *
 * Returns one ComplianceMatchResult per planned workout, in the same order.
 */
export function matchAllPlannedForDate(
  plans: ComplianceMatchInput["planned"][],
  actuals: ComplianceMatchInput["actuals"],
): ComplianceMatchResult[] {
  const claimed = new Set<string>();
  const results: ComplianceMatchResult[] = [];

  // Score all (plan, actual) pairs, then greedily assign best-first
  const pairs: Array<{ planIdx: number; actualId: string; score: SingleMatchScore }> = [];

  for (let pi = 0; pi < plans.length; pi++) {
    for (const actual of actuals) {
      const score = scoreActual(plans[pi], actual);
      pairs.push({ planIdx: pi, actualId: actual.id, score });
    }
  }

  // Sort descending by score
  pairs.sort((a, b) => b.score.score - a.score.score);

  const assignedPlans = new Map<number, { actualId: string; score: SingleMatchScore }>();

  for (const pair of pairs) {
    if (assignedPlans.has(pair.planIdx)) continue;
    if (claimed.has(pair.actualId)) continue;
    assignedPlans.set(pair.planIdx, { actualId: pair.actualId, score: pair.score });
    claimed.add(pair.actualId);
  }

  // Build results in plan order
  for (let pi = 0; pi < plans.length; pi++) {
    const assignment = assignedPlans.get(pi);
    if (!assignment) {
      results.push(matchWorkoutToPlanned({ planned: plans[pi], actuals: [] }));
      continue;
    }

    const bestActual = actuals.find((a) => a.id === assignment.actualId)!;
    const matchStatus = scoreToStatus(assignment.score.score);
    const unmatchedIds = actuals
      .filter((a) => !claimed.has(a.id))
      .map((a) => a.id);

    results.push({
      match_score: assignment.score.score,
      match_status: matchStatus,
      best_match_id: assignment.actualId,
      sport_match: assignment.score.sportMatch,
      duration_ratio: assignment.score.durationRatio,
      tss_ratio: assignment.score.tssRatio,
      unmatched_workout_ids: unmatchedIds,
      reason: buildReason(matchStatus, assignment.score, plans[pi], bestActual),
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Reason builder
// ---------------------------------------------------------------------------

function buildReason(
  status: MatchStatus,
  score: SingleMatchScore,
  planned: ComplianceMatchInput["planned"],
  actual: ComplianceMatchInput["actuals"][number] | null,
): string {
  switch (status) {
    case "missed":
      return "No workouts recorded on this date.";
    case "completed":
      return "Workout closely matches the planned session.";
    case "partial": {
      const issues: string[] = [];
      if (!score.sportMatch) issues.push("different sport");
      if (score.durationRatio != null && score.durationRatio < 0.6)
        issues.push("shorter than planned");
      if (score.durationRatio != null && score.durationRatio > 1.5)
        issues.push("longer than planned");
      if (score.tssRatio != null && score.tssRatio < 0.5)
        issues.push("lower intensity than planned");
      if (score.tssRatio != null && score.tssRatio > 1.5)
        issues.push("higher intensity than planned");
      return issues.length > 0
        ? `Partial match: ${issues.join(", ")}.`
        : "Partial match: some deviation from plan.";
    }
    case "substituted": {
      if (actual) {
        const actualSport = normalizeSport(actual.activity_type);
        const plannedSport = planned.sport
          ? normalizeSport(planned.sport)
          : "planned workout";
        return `Substituted: did ${actualSport} instead of ${plannedSport}.`;
      }
      return "Workout recorded but does not match the planned session.";
    }
  }
}
