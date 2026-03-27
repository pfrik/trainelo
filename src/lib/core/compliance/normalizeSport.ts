/**
 * Normalize Garmin activity_type strings to canonical sport categories.
 *
 * Single source of truth — replaces the duplicated detectSport() functions
 * in CalendarWidget.tsx and ActivityDetailDrawer.tsx.
 *
 * Pure function, no IO.
 */

import type { NormalizedSport } from "./types.js";

/**
 * Map a Garmin activity_type (or any free-text sport string) to a canonical
 * sport category. Case-insensitive, keyword-based.
 *
 * Handles Garmin strings like "RUNNING", "TREADMILL_RUNNING", "TRAIL_RUNNING",
 * "INDOOR_CYCLING", "OPEN_WATER_SWIMMING", "STRENGTH_TRAINING", etc.
 */
export function normalizeSport(activityType: string): NormalizedSport {
  const t = activityType.toLowerCase();

  if (t.includes("run") || t.includes("jog") || t.includes("walk") || t.includes("hik")) {
    return "running";
  }
  if (t.includes("bik") || t.includes("cycl") || t.includes("ride")) {
    return "cycling";
  }
  if (t.includes("swim") || t.includes("pool") || t.includes("water")) {
    return "swimming";
  }
  if (
    t.includes("strength") ||
    t.includes("gym") ||
    t.includes("core") ||
    t.includes("weight") ||
    t.includes("fitness") ||
    t.includes("yoga") ||
    t.includes("pilates")
  ) {
    return "strength";
  }

  return "other";
}

/**
 * Map a NormalizedSport back to the UI display key used by CalendarWidget
 * and ActivityDetailDrawer. This bridges the compliance layer's canonical
 * names with the UI's shorter keys.
 */
export function sportToDisplayKey(
  sport: NormalizedSport,
): "run" | "bike" | "swim" | "strength" | "other" {
  switch (sport) {
    case "running":
      return "run";
    case "cycling":
      return "bike";
    case "swimming":
      return "swim";
    case "strength":
      return "strength";
    default:
      return "other";
  }
}
