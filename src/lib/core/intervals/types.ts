/**
 * intervals.icu API response shapes (subset of fields Trainelo consumes).
 *
 * Wellness is pushed server-side from Garmin Connect (and other providers)
 * into intervals.icu; activities carry the upstream provider in `source`
 * and the provider's own ID in `external_id` (numeric Garmin activity ID
 * for GARMIN_CONNECT uploads — used for cross-source dedupe).
 *
 * API docs: https://forum.intervals.icu/t/api-access-to-intervals-icu/609
 */

/** One day of wellness data. `id` is the calendar date (YYYY-MM-DD). */
export interface IntervalsWellness {
  id: string;
  /** Resting heart rate in bpm. */
  restingHR?: number | null;
  /** Overnight HRV (rMSSD) in ms. */
  hrv?: number | null;
  /** Overnight HRV (SDNN) in ms. */
  hrvSDNN?: number | null;
  /** Time asleep in seconds. */
  sleepSecs?: number | null;
  /** Sleep score 0-100 (provider algorithm). */
  sleepScore?: number | null;
  /** intervals.icu subjective sleep quality (1-4). */
  sleepQuality?: number | null;
  /** Average heart rate while sleeping, bpm. */
  avgSleepingHR?: number | null;
  /** Blood oxygen saturation percent. */
  spO2?: number | null;
  steps?: number | null;
  /** Body weight in kg. */
  weight?: number | null;
  /** Respiration rate, breaths/min. */
  respiration?: number | null;
  /** Last update timestamp (ISO). */
  updated?: string | null;
  [key: string]: unknown;
}

/** One activity. `id` is the intervals.icu ID (e.g. "i161742359"). */
export interface IntervalsActivity {
  id: string;
  /** Upstream provider, e.g. "GARMIN_CONNECT", "STRAVA", "DROPBOX". */
  source?: string | null;
  /** Provider's own ID (numeric string for Garmin activities). */
  external_id?: string | null;
  /** intervals.icu sport type, e.g. "Ride", "Run", "OpenWaterSwim". */
  type?: string | null;
  sub_type?: string | null;
  name?: string | null;
  /** UTC start, ISO 8601 with Z suffix. */
  start_date?: string | null;
  start_date_local?: string | null;
  moving_time?: number | null;
  elapsed_time?: number | null;
  /** Distance in meters. */
  distance?: number | null;
  calories?: number | null;
  average_heartrate?: number | null;
  max_heartrate?: number | null;
  average_cadence?: number | null;
  icu_average_watts?: number | null;
  icu_weighted_avg_watts?: number | null;
  /** intervals.icu computed training load (TSS-equivalent). */
  icu_training_load?: number | null;
  /** Intensity as percent of threshold (IF * 100). */
  icu_intensity?: number | null;
  /** RPE 1-10 if the athlete entered one. */
  icu_rpe?: number | null;
  /** Subjective feel 1-5 if entered. */
  feel?: number | null;
  total_elevation_gain?: number | null;
  total_elevation_loss?: number | null;
  /** Average speed in m/s. */
  average_speed?: number | null;
  max_speed?: number | null;
  [key: string]: unknown;
}
