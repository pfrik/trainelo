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

/**
 * Persisted prior EWMA state (end-of-day values for `date`).
 * When provided, the recursion continues from `date + 1` instead of
 * replaying full history from zero — training older than the fetched
 * window stays embodied in the seed.
 */
export interface EwmaSeed {
  date: string; // YYYY-MM-DD the state represents (end of day)
  fitness: number; // raw EWMA TSS units
  fatigue: number; // raw EWMA TSS units
  /** Days of history embodied in the seed (drives cold-start flags). */
  data_days: number;
}

export interface EwmaOptions {
  fatigueTau?: number; // default 7
  fitnessTau?: number; // default 42
  /** Prior persisted state; ignored if its date is after targetDate. */
  seed?: EwmaSeed | null;
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
  const fatigueTau = options?.fatigueTau ?? 7;
  const fitnessTau = options?.fitnessTau ?? 42;
  const alphaFatigue = 1 - Math.exp(-1 / fatigueTau);
  const alphaFitness = 1 - Math.exp(-1 / fitnessTau);

  const endEpoch = dateToEpoch(targetDate);

  // Aggregate duplicate dates (multiple sources on same day)
  const byDate = new Map<string, number>();
  for (const entry of dailyTss) {
    byDate.set(entry.date, (byDate.get(entry.date) ?? 0) + entry.total_tss);
  }

  // --- Seeded path: continue the recursion from persisted state ---
  const seed = options?.seed;
  if (seed && dateToEpoch(seed.date) <= endEpoch) {
    const seedEpoch = dateToEpoch(seed.date);
    if (seedEpoch === endEpoch) {
      return {
        fitness: seed.fitness,
        fatigue: seed.fatigue,
        form: seed.fitness - seed.fatigue,
        data_days: seed.data_days,
      };
    }

    // Walk from the day after the seed through targetDate. Entries on or
    // before the seed date are ignored — they are embodied in the seed.
    const walkDays = Math.round((endEpoch - seedEpoch) / MS_PER_DAY);
    let ewmaFatigue = seed.fatigue;
    let ewmaFitness = seed.fitness;

    for (let i = 1; i <= walkDays; i++) {
      const epoch = seedEpoch + i * MS_PER_DAY;
      const d = new Date(epoch);
      const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      const tss = byDate.get(dateStr) ?? 0;
      ewmaFatigue = alphaFatigue * tss + (1 - alphaFatigue) * ewmaFatigue;
      ewmaFitness = alphaFitness * tss + (1 - alphaFitness) * ewmaFitness;
    }

    return {
      fitness: ewmaFitness,
      fatigue: ewmaFatigue,
      form: ewmaFitness - ewmaFatigue,
      data_days: seed.data_days + walkDays,
    };
  }

  // --- Unseeded path: replay the provided history from zero ---
  if (dailyTss.length === 0) {
    return { fitness: 0, fatigue: 0, form: 0, data_days: 0 };
  }

  // Determine date range: earliest entry to targetDate
  const dates = Array.from(byDate.keys()).sort();
  const startEpoch = dateToEpoch(dates[0]);

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
  // Derive form_score from raw form (same source as form_raw) so both
  // are consistent. Previously this used fitness_score - fatigue_score
  // which could diverge from form_raw due to rounding and clamping.
  const form_score = clamp(-100, Math.round((raw.form / ref) * 100), 100);

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
