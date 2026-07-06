/**
 * Transform an intervals.icu activity into a canonical workouts row.
 *
 * Uses the canonical activity_type vocabulary shared across the pipeline so
 * downstream sport normalization and compliance matching behave identically.
 */

import type { IntervalsActivity } from "./types.js";
import { INTERVALS_SOURCE, INTERVALS_SCHEMA_VERSION } from "./transformWellness.js";

/** intervals.icu sport type → canonical activity_type. */
const ACTIVITY_TYPE_MAP: Record<string, string> = {
  Ride: "bike",
  VirtualRide: "bike_indoor",
  EBikeRide: "bike",
  MountainBikeRide: "bike_mtb",
  GravelRide: "bike_gravel",
  Run: "run",
  VirtualRun: "run_indoor",
  TrailRun: "run_trail",
  Walk: "walk",
  Hike: "hike",
  Swim: "swim_pool",
  OpenWaterSwim: "swim_open",
  WeightTraining: "strength",
  Workout: "cardio",
  Yoga: "yoga",
  Pilates: "pilates",
  Rowing: "row",
  VirtualRow: "row",
  Elliptical: "elliptical",
  StairStepper: "stairs",
  NordicSki: "ski_xc",
  AlpineSki: "ski",
  BackcountrySki: "ski_bc",
  Snowboard: "ski",
  IceSkate: "other",
  InlineSkate: "other",
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function toInt(v: unknown): number | null {
  return isFiniteNumber(v) ? Math.round(v) : null;
}

/**
 * The Garmin activity ID for activities that reached intervals.icu via the
 * official Garmin Connect integration — matches workouts.source_ref written
 * by the Garmin scraper, enabling cross-source dedupe.
 */
export function getGarminSourceRef(activity: IntervalsActivity): string | null {
  if (activity.source !== "GARMIN_CONNECT") return null;
  const externalId = activity.external_id;
  if (typeof externalId !== "string" || !/^\d+$/.test(externalId)) return null;
  return externalId;
}

export function mapActivityType(intervalsType: string | null | undefined): string {
  if (!intervalsType) return "other";
  return ACTIVITY_TYPE_MAP[intervalsType] ?? "other";
}

export function transformActivity(
  activity: IntervalsActivity,
  userId: string,
): Record<string, unknown> {
  if (!activity.id) {
    throw new Error("Activity missing id");
  }
  const startedAt = activity.start_date;
  if (!startedAt || Number.isNaN(Date.parse(startedAt))) {
    throw new Error(`Activity ${activity.id} missing or invalid start_date`);
  }

  const durationSeconds = toInt(activity.elapsed_time) ?? toInt(activity.moving_time);
  const endedAt =
    durationSeconds != null
      ? new Date(Date.parse(startedAt) + durationSeconds * 1000).toISOString()
      : null;

  const rpe = toInt(activity.icu_rpe);
  const feel = toInt(activity.feel);

  return {
    user_id: userId,
    source: INTERVALS_SOURCE,
    source_ref: activity.id,
    schema_version: INTERVALS_SCHEMA_VERSION,
    activity_type: mapActivityType(activity.type),
    activity_subtype: activity.sub_type ?? null,
    title: activity.name ?? null,
    started_at: startedAt,
    ended_at: endedAt,
    duration_seconds: durationSeconds,
    moving_duration_seconds: toInt(activity.moving_time),
    elapsed_duration_seconds: toInt(activity.elapsed_time),
    distance_meters: isFiniteNumber(activity.distance)
      ? Math.round(activity.distance * 100) / 100
      : null,
    calories: toInt(activity.calories),
    avg_heart_rate: toInt(activity.average_heartrate),
    max_heart_rate: toInt(activity.max_heartrate),
    avg_cadence: toInt(activity.average_cadence),
    avg_power_watts: toInt(activity.icu_average_watts),
    normalized_power_watts: toInt(activity.icu_weighted_avg_watts),
    training_stress_score: isFiniteNumber(activity.icu_training_load)
      ? Math.round(activity.icu_training_load * 100) / 100
      : null,
    // icu_intensity is IF * 100 (e.g. 94.9 → 0.949)
    intensity_factor: isFiniteNumber(activity.icu_intensity)
      ? Math.round(activity.icu_intensity * 10) / 1000
      : null,
    elevation_gain_meters: toInt(activity.total_elevation_gain),
    elevation_loss_meters: toInt(activity.total_elevation_loss),
    avg_speed_mps: isFiniteNumber(activity.average_speed) ? activity.average_speed : null,
    max_speed_mps: isFiniteNumber(activity.max_speed) ? activity.max_speed : null,
    perceived_exertion: rpe != null && rpe >= 1 && rpe <= 10 ? rpe : null,
    feeling_score: feel != null && feel >= 1 && feel <= 5 ? feel : null,
    raw_data: activity,
  };
}
