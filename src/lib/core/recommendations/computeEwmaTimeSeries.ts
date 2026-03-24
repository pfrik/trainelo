/**
 * Compute EWMA time series — returns intermediate state for every day.
 * Same Banister model as computeEwma but captures daily snapshots
 * for PMC chart persistence and visualization.
 *
 * Pure function, no IO.
 */

import type { DailyTssEntry, EwmaOptions } from "./computeEwma.js";

// ============================================================================
// Types
// ============================================================================

export interface EwmaDailyPoint {
  date: string; // YYYY-MM-DD
  fitness: number; // raw EWMA TSS units
  fatigue: number; // raw EWMA TSS units
  form: number; // fitness - fatigue
  tss: number; // that day's input TSS
}

// ============================================================================
// Helpers
// ============================================================================

function dateToEpoch(d: string): number {
  return Date.UTC(
    parseInt(d.slice(0, 4), 10),
    parseInt(d.slice(5, 7), 10) - 1,
    parseInt(d.slice(8, 10), 10),
  );
}

const MS_PER_DAY = 86_400_000;

function epochToDate(epoch: number): string {
  const d = new Date(epoch);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ============================================================================
// Core
// ============================================================================

/**
 * Compute EWMA time series from daily TSS entries.
 *
 * @param dailyTss - Array of daily TSS entries (can be unsorted, can have gaps)
 * @param startDate - First date to include in output (YYYY-MM-DD)
 * @param endDate - Last date to include in output (YYYY-MM-DD)
 * @param options - Optional tau overrides
 * @returns Array of daily EWMA points, one per day from startDate to endDate
 */
export function computeEwmaTimeSeries(
  dailyTss: DailyTssEntry[],
  startDate: string,
  endDate: string,
  options?: EwmaOptions,
): EwmaDailyPoint[] {
  if (dailyTss.length === 0) return [];

  const fatigueTau = options?.fatigueTau ?? 7;
  const fitnessTau = options?.fitnessTau ?? 42;
  const alphaFatigue = 1 - Math.exp(-1 / fatigueTau);
  const alphaFitness = 1 - Math.exp(-1 / fitnessTau);

  // Sort ascending by date
  const sorted = [...dailyTss].sort(
    (a, b) => dateToEpoch(a.date) - dateToEpoch(b.date),
  );

  // Aggregate duplicate dates
  const byDate = new Map<string, number>();
  for (const entry of sorted) {
    byDate.set(entry.date, (byDate.get(entry.date) ?? 0) + entry.total_tss);
  }

  // Determine full range: earliest data to endDate
  const dates = Array.from(byDate.keys()).sort();
  const dataStartEpoch = dateToEpoch(dates[0]);
  const endEpoch = dateToEpoch(endDate);
  const outputStartEpoch = dateToEpoch(startDate);

  if (endEpoch < dataStartEpoch) return [];

  // Walk from earliest data through endDate, capturing state
  const totalDays = Math.round((endEpoch - dataStartEpoch) / MS_PER_DAY) + 1;

  let ewmaFatigue = 0;
  let ewmaFitness = 0;
  const result: EwmaDailyPoint[] = [];

  for (let i = 0; i < totalDays; i++) {
    const epoch = dataStartEpoch + i * MS_PER_DAY;
    const dateStr = epochToDate(epoch);
    const tss = byDate.get(dateStr) ?? 0;

    ewmaFatigue = alphaFatigue * tss + (1 - alphaFatigue) * ewmaFatigue;
    ewmaFitness = alphaFitness * tss + (1 - alphaFitness) * ewmaFitness;

    // Only include in output if within requested range
    if (epoch >= outputStartEpoch) {
      result.push({
        date: dateStr,
        fitness: Math.round(ewmaFitness * 10000) / 10000,
        fatigue: Math.round(ewmaFatigue * 10000) / 10000,
        form: Math.round((ewmaFitness - ewmaFatigue) * 10000) / 10000,
        tss,
      });
    }
  }

  return result;
}
