/**
 * Transform an intervals.icu wellness day into canonical table rows.
 *
 * One wellness record fans out to up to four rows:
 *   - canonical_daily_metrics (steps, RHR, SpO2, weight, respiration)
 *   - sleep_sessions          (sleep seconds + score; timestamps synthesized)
 *   - hrv_nights              (rMSSD; baseline computed from trailing history)
 *   - daily_metrics (MVP)     (aggregated hrv_ms / RHR / sleep hours+quality)
 *
 * intervals.icu has no HRV baseline concept, so the baseline is computed
 * here as the trailing 28-day mean of nightly rMSSD (min 3 readings).
 * Passive calibration's personal_thresholds.hrv_baseline still overrides
 * this downstream in computeReadinessAndFatigue.
 */

import type { IntervalsWellness } from "./types.js";

export const INTERVALS_SOURCE = "intervals_icu";
export const INTERVALS_SCHEMA_VERSION = "1.0";

const HRV_BASELINE_WINDOW_DAYS = 28;
const HRV_BASELINE_MIN_READINGS = 3;
const HRV_WEEKLY_WINDOW_DAYS = 7;
const HRV_STATUS_LOW_RATIO = 0.85;
const HRV_STATUS_ELEVATED_RATIO = 1.15;

/** One nightly rMSSD reading; callers must pass at most one entry per date. */
export interface HrvHistoryEntry {
  date: string;
  hrv_rmssd: number;
}

export interface WellnessTransformResult {
  /** Row for canonical_daily_metrics, or null when no fields present. */
  dailyMetrics: Record<string, unknown> | null;
  /** Row for sleep_sessions, or null when no sleep duration. */
  sleepSession: Record<string, unknown> | null;
  /** Row for hrv_nights, or null when no HRV reading. */
  hrvNight: Record<string, unknown> | null;
  /** Row for the MVP daily_metrics table, or null when nothing to store. */
  dailyMetricsMvp: Record<string, unknown> | null;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Shift a YYYY-MM-DD date string by a number of days (UTC-safe). */
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Trailing mean of rMSSD over [date-28, date-1].
 * Returns null with fewer than 3 readings (cold start).
 */
export function computeHrvBaseline(
  date: string,
  history: HrvHistoryEntry[],
): number | null {
  const from = shiftDate(date, -HRV_BASELINE_WINDOW_DAYS);
  const to = shiftDate(date, -1);
  const values = history
    .filter((e) => e.date >= from && e.date <= to && e.hrv_rmssd > 0)
    .map((e) => e.hrv_rmssd);
  if (values.length < HRV_BASELINE_MIN_READINGS) return null;
  return round2(values.reduce((a, b) => a + b, 0) / values.length);
}

/** Rolling 7-day mean including the current night. */
export function computeHrvWeeklyAvg(
  date: string,
  history: HrvHistoryEntry[],
  currentValue: number,
): number {
  const from = shiftDate(date, -(HRV_WEEKLY_WINDOW_DAYS - 1));
  const to = shiftDate(date, -1);
  const values = history
    .filter((e) => e.date >= from && e.date <= to && e.hrv_rmssd > 0)
    .map((e) => e.hrv_rmssd);
  values.push(currentValue);
  return round2(values.reduce((a, b) => a + b, 0) / values.length);
}

function deriveHrvStatus(rmssd: number, baseline: number | null): string {
  if (baseline == null || baseline <= 0) return "unknown";
  const ratio = rmssd / baseline;
  if (ratio < HRV_STATUS_LOW_RATIO) return "low";
  if (ratio > HRV_STATUS_ELEVATED_RATIO) return "elevated";
  return "normal";
}

export function transformWellness(
  wellness: IntervalsWellness,
  userId: string,
  hrvHistory: HrvHistoryEntry[],
): WellnessTransformResult {
  const date = wellness.id;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Wellness record has invalid date id: ${String(date)}`);
  }

  const base = {
    user_id: userId,
    source: INTERVALS_SOURCE,
    schema_version: INTERVALS_SCHEMA_VERSION,
    date,
  };

  // --- canonical_daily_metrics -------------------------------------------
  const restingHr = isFiniteNumber(wellness.restingHR) ? Math.round(wellness.restingHR) : null;
  const steps = isFiniteNumber(wellness.steps) ? Math.round(wellness.steps) : null;
  const spO2 = isFiniteNumber(wellness.spO2) ? round2(wellness.spO2) : null;
  const weight = isFiniteNumber(wellness.weight) ? round2(wellness.weight) : null;
  const respiration = isFiniteNumber(wellness.respiration) ? round2(wellness.respiration) : null;

  const hasDailyMetrics =
    restingHr != null || steps != null || spO2 != null || weight != null || respiration != null;

  const dailyMetrics = hasDailyMetrics
    ? {
        ...base,
        source_ref: `daily_${date}`,
        steps,
        resting_heart_rate: restingHr,
        blood_oxygen_avg: spO2,
        weight_kg: weight,
        respiration_rate: respiration,
        raw_data: wellness,
      }
    : null;

  // --- sleep_sessions ------------------------------------------------------
  // intervals.icu wellness carries no bed/wake timestamps, only duration.
  // sleep_start/sleep_end are synthesized from midnight UTC so the NOT NULL
  // and end > start constraints hold; sleep_seconds carries the real value.
  const sleepSecs = isFiniteNumber(wellness.sleepSecs) && wellness.sleepSecs > 0
    ? Math.round(wellness.sleepSecs)
    : null;
  const sleepScore = isFiniteNumber(wellness.sleepScore)
    ? Math.max(0, Math.min(100, Math.round(wellness.sleepScore)))
    : null;

  let sleepSession: Record<string, unknown> | null = null;
  if (sleepSecs != null) {
    const sleepStart = `${date}T00:00:00.000Z`;
    const sleepEnd = new Date(Date.parse(sleepStart) + sleepSecs * 1000).toISOString();
    sleepSession = {
      ...base,
      source_ref: `sleep_${date}`,
      sleep_start: sleepStart,
      sleep_end: sleepEnd,
      sleep_seconds: sleepSecs,
      sleep_score: sleepScore,
      avg_heart_rate: isFiniteNumber(wellness.avgSleepingHR)
        ? Math.round(wellness.avgSleepingHR)
        : null,
      avg_hrv_ms: isFiniteNumber(wellness.hrv) ? round2(wellness.hrv) : null,
      raw_data: wellness,
    };
  }

  // --- hrv_nights ----------------------------------------------------------
  const rmssd = isFiniteNumber(wellness.hrv) && wellness.hrv > 0 ? round2(wellness.hrv) : null;

  let hrvNight: Record<string, unknown> | null = null;
  if (rmssd != null) {
    const baseline = computeHrvBaseline(date, hrvHistory);
    const weeklyAvg = computeHrvWeeklyAvg(date, hrvHistory, rmssd);
    hrvNight = {
      ...base,
      source_ref: `hrv_${date}`,
      hrv_rmssd: rmssd,
      hrv_sdrr: isFiniteNumber(wellness.hrvSDNN) ? round2(wellness.hrvSDNN) : null,
      hrv_baseline: baseline,
      hrv_status: deriveHrvStatus(rmssd, baseline),
      weekly_avg: weeklyAvg,
      seven_day_change_percent:
        baseline != null && baseline > 0
          ? Math.round(((weeklyAvg - baseline) / baseline) * 1000) / 10
          : null,
      raw_data: wellness,
    };
  }

  // --- daily_metrics (MVP) -------------------------------------------------
  const sleepHours = sleepSecs != null ? round2(sleepSecs / 3600) : null;
  const sleepQuality =
    sleepScore != null && sleepScore > 0
      ? Math.max(1, Math.min(10, Math.round(sleepScore / 10)))
      : null;
  const hrvMs = rmssd != null ? Math.round(rmssd) : null;

  const hasMvp =
    hrvMs != null || restingHr != null || sleepHours != null || sleepQuality != null;

  const dailyMetricsMvp = hasMvp
    ? {
        user_id: userId,
        date,
        ...(hrvMs != null ? { hrv_ms: hrvMs } : {}),
        ...(restingHr != null ? { resting_heart_rate: restingHr } : {}),
        ...(sleepHours != null ? { sleep_hours: sleepHours } : {}),
        ...(sleepQuality != null ? { sleep_quality: sleepQuality } : {}),
      }
    : null;

  return { dailyMetrics, sleepSession, hrvNight, dailyMetricsMvp };
}
