/**
 * EWMA (Exponentially Weighted Moving Average) fitness/fatigue model.
 * Implements a Banister impulse-response model for training load.
 *
 * Pure functions, no IO.
 *
 * - Fatigue EWMA (tau=7d): acute stress, decays quickly
 * - Fitness EWMA (tau=42d): chronic adaptation, decays slowly
 * - Form = fitness - fatigue: positive = fresh+adapted, negative = overreached
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DailyTssEntry {
  date: string; // YYYY-MM-DD
  total_tss: number;
}

export interface EwmaResult {
  fitness: number; // raw EWMA in TSS units
  fatigue: number; // raw EWMA in TSS units
  form: number; // fitness - fatigue
  data_days: number; // days of history used
}

export interface EwmaOptions {
  fatigueTau?: number; // default 7
  fitnessTau?: number; // default 42
}

export interface NormalizedEwmaResult {
  fitness_score: number; // 0-100
  fatigue_score: number; // 0-100
  form_score: number; // -100 to +100
  fitness_raw: number; // raw EWMA TSS
  fatigue_raw: number; // raw EWMA TSS
  form_raw: number; // raw form TSS
  data_days: number;
  cold_start_fatigue: boolean; // <7 days: fatigue unreliable
  cold_start_fitness: boolean; // <14 days: fitness unreliable
}

export interface NormalizeOptions {
  /** Reference daily TSS load for normalization (default 100). */
  referenceTssPerDay?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse YYYY-MM-DD to epoch ms (UTC midnight). */
function dateToEpoch(d: string): number {
  return Date.UTC(
    parseInt(d.slice(0, 4), 10),
    parseInt(d.slice(5, 7), 10) - 1,
    parseInt(d.slice(8, 10), 10),
  );
}

const MS_PER_DAY = 86_400_000;

function clamp(min: number, value: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Core EWMA
// ---------------------------------------------------------------------------

/**
 * Compute raw EWMA fitness and fatigue from daily TSS history.
 *
 * - Sorts entries ascending by date
 * - Fills date gaps with 0 TSS (rest days)
 * - Seeds EWMA at first day's TSS value
 * - Walks forward: ewma = alpha * tss + (1 - alpha) * prev
 *
 * @param dailyTss - Array of daily TSS entries
 * @param targetDate - YYYY-MM-DD date to compute up to (inclusive)
 * @param options - Optional tau overrides
 */
export function computeEwma(
  dailyTss: DailyTssEntry[],
  targetDate: string,
  options?: EwmaOptions,
): EwmaResult {
  if (dailyTss.length === 0) {
    return { fitness: 0, fatigue: 0, form: 0, data_days: 0 };
  }

  const fatigueTau = options?.fatigueTau ?? 7;
  const fitnessTau = options?.fitnessTau ?? 42;
  const alphaFatigue = 1 - Math.exp(-1 / fatigueTau);
  const alphaFitness = 1 - Math.exp(-1 / fitnessTau);

  // Sort ascending by date
  const sorted = [...dailyTss].sort(
    (a, b) => dateToEpoch(a.date) - dateToEpoch(b.date),
  );

  // Aggregate duplicate dates (multiple sources on same day)
  const byDate = new Map<string, number>();
  for (const entry of sorted) {
    byDate.set(entry.date, (byDate.get(entry.date) ?? 0) + entry.total_tss);
  }

  // Determine date range: earliest entry to targetDate
  const dates = Array.from(byDate.keys()).sort();
  const startEpoch = dateToEpoch(dates[0]);
  const endEpoch = dateToEpoch(targetDate);

  if (endEpoch < startEpoch) {
    return { fitness: 0, fatigue: 0, form: 0, data_days: 0 };
  }

  // Build gap-filled daily TSS array
  const totalDays = Math.round((endEpoch - startEpoch) / MS_PER_DAY) + 1;
  const dailyValues: number[] = new Array(totalDays).fill(0);

  for (const [date, tss] of byDate) {
    const dayIndex = Math.round((dateToEpoch(date) - startEpoch) / MS_PER_DAY);
    if (dayIndex >= 0 && dayIndex < totalDays) {
      dailyValues[dayIndex] = tss;
    }
  }

  // Seed at 0 and let EWMA warm up naturally.
  // Seeding at first day's TSS would create a spike artifact if the first
  // recorded day happens to be unusually high (e.g. a race).
  let ewmaFatigue = 0;
  let ewmaFitness = 0;

  for (let i = 0; i < totalDays; i++) {
    const tss = dailyValues[i];
    ewmaFatigue = alphaFatigue * tss + (1 - alphaFatigue) * ewmaFatigue;
    ewmaFitness = alphaFitness * tss + (1 - alphaFitness) * ewmaFitness;
  }

  return {
    fitness: ewmaFitness,
    fatigue: ewmaFatigue,
    form: ewmaFitness - ewmaFatigue,
    data_days: totalDays,
  };
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Normalize raw EWMA values to human-readable scores.
 *
 * - fitness_score: 0-100 (based on reference load)
 * - fatigue_score: 0-100
 * - form_score: -100 to +100
 * - Cold start flags when insufficient data history
 */
export function normalizeEwma(
  raw: EwmaResult,
  options?: NormalizeOptions,
): NormalizedEwmaResult {
  const ref = options?.referenceTssPerDay ?? 100;

  const fitness_score = clamp(0, Math.round((raw.fitness / ref) * 100), 100);
  const fatigue_score = clamp(0, Math.round((raw.fatigue / ref) * 100), 100);
  const form_score = clamp(-100, fitness_score - fatigue_score, 100);

  return {
    fitness_score,
    fatigue_score,
    form_score,
    fitness_raw: raw.fitness,
    fatigue_raw: raw.fatigue,
    form_raw: raw.form,
    data_days: raw.data_days,
    cold_start_fatigue: raw.data_days < 7,
    cold_start_fitness: raw.data_days < 14,
  };
}
