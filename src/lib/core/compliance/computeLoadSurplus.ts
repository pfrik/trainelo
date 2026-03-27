/**
 * Compute the daily load surplus: how much actual TSS exceeded planned TSS,
 * including cross-sport transfer coefficients.
 *
 * Pure function, no IO.
 */

import type { DailyLoadSurplusInput, LoadSurplusResult, SourceAttribution } from "./types.js";
import { computeTransferredTss } from "./sportTransfer.js";

/** Threshold: surplus_ratio above this = has_unplanned_load. */
const SURPLUS_THRESHOLD = 1.5;

/**
 * Compute load surplus for a single day.
 *
 * - `surplus_tss`: raw difference (actual - planned)
 * - `surplus_ratio`: actual / planned
 * - `cross_sport_tss`: TSS from sports different than planned
 * - `transferred_tss`: cross-sport TSS after transfer coefficient discount
 * - `source_attribution`: per-workout breakdown with is_planned flag
 */
export function computeLoadSurplus(input: DailyLoadSurplusInput): LoadSurplusResult {
  const { planned_tss, actual_tss, planned_sport, actual_workouts, matched_workout_ids } = input;

  const matchedSet = new Set(matched_workout_ids);

  // Build source attribution
  const source_attribution: SourceAttribution[] = actual_workouts.map((w) => ({
    id: w.id,
    source: w.source,
    sport: w.sport,
    tss: w.tss,
    is_planned: matchedSet.has(w.id),
  }));

  // Compute surplus
  const surplus_tss = actual_tss - planned_tss;

  let surplus_ratio: number;
  if (planned_tss > 0) {
    surplus_ratio = actual_tss / planned_tss;
  } else if (actual_tss > 0) {
    surplus_ratio = Infinity;
  } else {
    surplus_ratio = 1.0; // both zero = on plan
  }

  // Compute cross-sport TSS from unmatched workouts only.
  // Matched cross-sport workouts (substitutions) are already captured by compliance matching.
  let cross_sport_tss = 0;
  let transferred_tss = 0;

  for (const w of actual_workouts) {
    if (!matchedSet.has(w.id) && planned_sport && w.sport !== planned_sport) {
      cross_sport_tss += w.tss;
      transferred_tss += computeTransferredTss(w.sport, planned_sport, w.tss);
    }
  }

  return {
    surplus_tss: Math.round(surplus_tss * 100) / 100,
    surplus_ratio: surplus_ratio === Infinity ? Infinity : Math.round(surplus_ratio * 100) / 100,
    has_unplanned_load: surplus_ratio > SURPLUS_THRESHOLD,
    cross_sport_tss: Math.round(cross_sport_tss * 100) / 100,
    transferred_tss: Math.round(transferred_tss * 100) / 100,
    source_attribution,
  };
}
