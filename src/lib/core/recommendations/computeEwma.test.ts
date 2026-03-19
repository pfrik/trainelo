import { describe, it, expect } from "vitest";
import {
  computeEwma,
  normalizeEwma,
  type DailyTssEntry,
  type EwmaResult,
} from "./computeEwma";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate N days of constant TSS ending on targetDate. */
function constantLoad(
  tssPerDay: number,
  days: number,
  endDate: string = "2026-03-19",
): DailyTssEntry[] {
  const entries: DailyTssEntry[] = [];
  const end = new Date(endDate + "T00:00:00Z");
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    entries.push({
      date: d.toISOString().slice(0, 10),
      total_tss: tssPerDay,
    });
  }
  return entries;
}

/** Generate a single impulse on a given date. */
function singleImpulse(
  tss: number,
  date: string = "2026-03-01",
): DailyTssEntry[] {
  return [{ date, total_tss: tss }];
}

/** Generate Mon/Wed/Fri pattern over N weeks. */
function mwfPattern(
  tssPerSession: number,
  weeks: number,
  startDate: string = "2026-01-05", // Monday
): DailyTssEntry[] {
  const entries: DailyTssEntry[] = [];
  const start = new Date(startDate + "T00:00:00Z");
  for (let w = 0; w < weeks; w++) {
    for (const offset of [0, 2, 4]) {
      // Mon, Wed, Fri
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + w * 7 + offset);
      entries.push({
        date: d.toISOString().slice(0, 10),
        total_tss: tssPerSession,
      });
    }
  }
  return entries;
}

// ---------------------------------------------------------------------------
// computeEwma tests
// ---------------------------------------------------------------------------

describe("computeEwma", () => {
  // --- Empty / edge inputs ---

  it("returns zeroes for empty input", () => {
    const result = computeEwma([], "2026-03-19");
    expect(result).toEqual({ fitness: 0, fatigue: 0, form: 0, data_days: 0 });
  });

  it("returns data for a single day (zero-seeded, absorbs alpha * TSS)", () => {
    const result = computeEwma(singleImpulse(100, "2026-03-19"), "2026-03-19");
    expect(result.data_days).toBe(1);
    // With zero seeding: ewma = alpha * 100 + (1-alpha) * 0 = alpha * 100
    // alpha_fatigue ≈ 0.133, alpha_fitness ≈ 0.0235
    expect(result.fatigue).toBeGreaterThan(10);
    expect(result.fatigue).toBeLessThan(20);
    expect(result.fitness).toBeGreaterThan(1);
    expect(result.fitness).toBeLessThan(5);
    expect(result.form).toBeLessThan(0); // fatigue absorbs more initially
  });

  it("returns zeroes when targetDate is before all entries", () => {
    const result = computeEwma(singleImpulse(100, "2026-03-19"), "2026-03-01");
    expect(result).toEqual({ fitness: 0, fatigue: 0, form: 0, data_days: 0 });
  });

  // --- Constant load convergence ---

  it("converges to ~50 for constant 50 TSS/day over 180 days", () => {
    // With zero seeding, fitness (tau=42) needs ~4 tau = 168 days to converge.
    // At 180 days: 50 * (1 - exp(-180/42)) ≈ 49.3
    const entries = constantLoad(50, 180);
    const result = computeEwma(entries, "2026-03-19");
    expect(result.fitness).toBeGreaterThan(48);
    expect(result.fitness).toBeLessThan(51);
    expect(result.fatigue).toBeCloseTo(50, 0);
    expect(result.data_days).toBe(180);
  });

  it("converges to ~100 for constant 100 TSS/day over 180 days", () => {
    const entries = constantLoad(100, 180);
    const result = computeEwma(entries, "2026-03-19");
    expect(result.fitness).toBeGreaterThan(97);
    expect(result.fitness).toBeLessThan(101);
    expect(result.fatigue).toBeCloseTo(100, 0);
  });

  it("fatigue converges faster than fitness for constant load", () => {
    // After 30 days of constant 50 TSS, fatigue (tau=7) should be
    // much closer to 50 than fitness (tau=42)
    const entries = constantLoad(50, 30);
    const result = computeEwma(entries, "2026-03-19");
    // Fatigue: 50 * (1 - exp(-30/7)) ≈ 50 * 0.987 ≈ 49.3
    expect(result.fatigue).toBeGreaterThan(48);
    // Fitness: 50 * (1 - exp(-30/42)) ≈ 50 * 0.511 ≈ 25.6
    expect(result.fitness).toBeLessThan(30);
  });

  // --- Impulse response: fatigue decays faster ---

  it("fatigue decays faster than fitness after a training block + rest", () => {
    // 30 days of training then 15 days of rest — the classic taper scenario.
    // After rest, fatigue (tau=7) should have decayed much more than fitness (tau=42).
    const entries: DailyTssEntry[] = [];
    for (let i = 44; i >= 0; i--) {
      const d = new Date("2026-03-19T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - i);
      entries.push({
        date: d.toISOString().slice(0, 10),
        total_tss: i >= 15 ? 80 : 0, // 30 days training, 15 days rest
      });
    }
    const result = computeEwma(entries, "2026-03-19");

    // Fatigue should have decayed to near zero after 15 rest days (2+ tau)
    expect(result.fatigue).toBeLessThan(10);
    // Fitness decays slowly — still substantial after 15 days rest
    expect(result.fitness).toBeGreaterThan(15);
    expect(result.fatigue).toBeLessThan(result.fitness);
  });

  it("form is positive after training block + taper (fresh + adapted)", () => {
    // Same taper scenario: positive form means fitness exceeds fatigue
    const entries: DailyTssEntry[] = [];
    for (let i = 44; i >= 0; i--) {
      const d = new Date("2026-03-19T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - i);
      entries.push({
        date: d.toISOString().slice(0, 10),
        total_tss: i >= 15 ? 80 : 0,
      });
    }
    const result = computeEwma(entries, "2026-03-19");
    expect(result.form).toBeGreaterThan(0);
  });

  // --- Gap filling ---

  it("fills rest days with 0 TSS for Mon/Wed/Fri pattern", () => {
    const entries = mwfPattern(80, 4);
    const lastDate = entries[entries.length - 1].date;
    const result = computeEwma(entries, lastDate);

    // Should have counted all days (4 weeks = 25 days from first Mon to last Fri)
    expect(result.data_days).toBeGreaterThanOrEqual(25);
    // Both EWMA values should be positive but less than 80 (due to rest days)
    expect(result.fitness).toBeGreaterThan(0);
    expect(result.fitness).toBeLessThan(80);
    expect(result.fatigue).toBeGreaterThan(0);
    expect(result.fatigue).toBeLessThan(80);
  });

  // --- Aggregate duplicate dates ---

  it("aggregates multiple entries on the same date", () => {
    const entries: DailyTssEntry[] = [
      { date: "2026-03-19", total_tss: 40 },
      { date: "2026-03-19", total_tss: 60 },
    ];
    const result = computeEwma(entries, "2026-03-19");
    // Should produce same result as a single 100 TSS entry
    const single = computeEwma(singleImpulse(100, "2026-03-19"), "2026-03-19");
    expect(result.fitness).toBe(single.fitness);
    expect(result.fatigue).toBe(single.fatigue);
  });

  // --- Determinism ---

  it("is deterministic (same input → same output)", () => {
    const entries = constantLoad(50, 30);
    const a = computeEwma(entries, "2026-03-19");
    const b = computeEwma(entries, "2026-03-19");
    expect(a).toEqual(b);
  });

  // --- Data days counting ---

  it("counts days from first entry to targetDate", () => {
    const entries: DailyTssEntry[] = [
      { date: "2026-03-10", total_tss: 50 },
      { date: "2026-03-15", total_tss: 60 },
    ];
    const result = computeEwma(entries, "2026-03-19");
    // March 10 to March 19 = 10 days
    expect(result.data_days).toBe(10);
  });

  // --- Custom tau ---

  it("accepts custom tau values", () => {
    // Use a single impulse + decay to amplify tau differences
    const entries = singleImpulse(100, "2026-03-01");
    const target = "2026-03-11"; // 10 days later
    const defaultResult = computeEwma(entries, target);
    const customResult = computeEwma(entries, target, {
      fatigueTau: 3,
      fitnessTau: 20,
    });
    // Faster fatigue tau = more decay, so custom fatigue < default fatigue
    expect(customResult.fatigue).toBeLessThan(defaultResult.fatigue);
  });

  // --- Unsorted input handled correctly ---

  it("handles unsorted input by sorting internally", () => {
    const sorted: DailyTssEntry[] = [
      { date: "2026-03-17", total_tss: 50 },
      { date: "2026-03-18", total_tss: 60 },
      { date: "2026-03-19", total_tss: 70 },
    ];
    const shuffled: DailyTssEntry[] = [
      { date: "2026-03-19", total_tss: 70 },
      { date: "2026-03-17", total_tss: 50 },
      { date: "2026-03-18", total_tss: 60 },
    ];
    expect(computeEwma(sorted, "2026-03-19")).toEqual(
      computeEwma(shuffled, "2026-03-19"),
    );
  });
});

// ---------------------------------------------------------------------------
// normalizeEwma tests
// ---------------------------------------------------------------------------

describe("normalizeEwma", () => {
  it("returns zeroes for zero raw values", () => {
    const raw: EwmaResult = { fitness: 0, fatigue: 0, form: 0, data_days: 0 };
    const result = normalizeEwma(raw);
    expect(result.fitness_score).toBe(0);
    expect(result.fatigue_score).toBe(0);
    expect(result.form_score).toBe(0);
  });

  it("normalizes reference load (100 TSS/day) to score 100", () => {
    const raw: EwmaResult = {
      fitness: 100,
      fatigue: 100,
      form: 0,
      data_days: 60,
    };
    const result = normalizeEwma(raw);
    expect(result.fitness_score).toBe(100);
    expect(result.fatigue_score).toBe(100);
    expect(result.form_score).toBe(0);
  });

  it("normalizes 50 TSS/day to score 50", () => {
    const raw: EwmaResult = {
      fitness: 50,
      fatigue: 50,
      form: 0,
      data_days: 60,
    };
    const result = normalizeEwma(raw);
    expect(result.fitness_score).toBe(50);
    expect(result.fatigue_score).toBe(50);
  });

  // --- Score bounds ---

  it("clamps fitness_score to [0, 100]", () => {
    const high: EwmaResult = {
      fitness: 200,
      fatigue: 0,
      form: 200,
      data_days: 60,
    };
    expect(normalizeEwma(high).fitness_score).toBe(100);

    const neg: EwmaResult = {
      fitness: -10,
      fatigue: 0,
      form: -10,
      data_days: 60,
    };
    expect(normalizeEwma(neg).fitness_score).toBe(0);
  });

  it("clamps fatigue_score to [0, 100]", () => {
    const high: EwmaResult = {
      fitness: 0,
      fatigue: 200,
      form: -200,
      data_days: 60,
    };
    expect(normalizeEwma(high).fatigue_score).toBe(100);
  });

  it("clamps form_score to [-100, 100]", () => {
    const extremePos: EwmaResult = {
      fitness: 200,
      fatigue: 0,
      form: 200,
      data_days: 60,
    };
    expect(normalizeEwma(extremePos).form_score).toBe(100);

    const extremeNeg: EwmaResult = {
      fitness: 0,
      fatigue: 200,
      form: -200,
      data_days: 60,
    };
    expect(normalizeEwma(extremeNeg).form_score).toBe(-100);
  });

  // --- Cold start thresholds ---

  it("cold_start_fatigue = true when data_days < 7", () => {
    const raw: EwmaResult = { fitness: 50, fatigue: 50, form: 0, data_days: 6 };
    expect(normalizeEwma(raw).cold_start_fatigue).toBe(true);
  });

  it("cold_start_fatigue = false when data_days >= 7", () => {
    const raw: EwmaResult = { fitness: 50, fatigue: 50, form: 0, data_days: 7 };
    expect(normalizeEwma(raw).cold_start_fatigue).toBe(false);
  });

  it("cold_start_fitness = true when data_days < 14", () => {
    const raw: EwmaResult = {
      fitness: 50,
      fatigue: 50,
      form: 0,
      data_days: 13,
    };
    expect(normalizeEwma(raw).cold_start_fitness).toBe(true);
  });

  it("cold_start_fitness = false when data_days >= 14", () => {
    const raw: EwmaResult = {
      fitness: 50,
      fatigue: 50,
      form: 0,
      data_days: 14,
    };
    expect(normalizeEwma(raw).cold_start_fitness).toBe(false);
  });

  // --- Raw values passthrough ---

  it("passes through raw values", () => {
    const raw: EwmaResult = {
      fitness: 42.5,
      fatigue: 63.2,
      form: -20.7,
      data_days: 30,
    };
    const result = normalizeEwma(raw);
    expect(result.fitness_raw).toBe(42.5);
    expect(result.fatigue_raw).toBe(63.2);
    expect(result.form_raw).toBe(-20.7);
    expect(result.data_days).toBe(30);
  });

  // --- Custom reference ---

  it("accepts custom referenceTssPerDay", () => {
    const raw: EwmaResult = {
      fitness: 50,
      fatigue: 50,
      form: 0,
      data_days: 60,
    };
    // With ref=50, 50 TSS should normalize to 100
    const result = normalizeEwma(raw, { referenceTssPerDay: 50 });
    expect(result.fitness_score).toBe(100);
    expect(result.fatigue_score).toBe(100);
  });

  // --- Determinism ---

  it("is deterministic", () => {
    const raw: EwmaResult = {
      fitness: 55,
      fatigue: 30,
      form: 25,
      data_days: 40,
    };
    const a = normalizeEwma(raw);
    const b = normalizeEwma(raw);
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// Integration: computeEwma → normalizeEwma
// ---------------------------------------------------------------------------

describe("computeEwma → normalizeEwma integration", () => {
  it("constant 50 TSS/day × 180 days → fitness_score ~50, fatigue_score ~50", () => {
    const entries = constantLoad(50, 180);
    const raw = computeEwma(entries, "2026-03-19");
    const norm = normalizeEwma(raw);

    expect(norm.fitness_score).toBeGreaterThanOrEqual(45);
    expect(norm.fitness_score).toBeLessThanOrEqual(55);
    expect(norm.fatigue_score).toBeGreaterThanOrEqual(45);
    expect(norm.fatigue_score).toBeLessThanOrEqual(55);
    expect(norm.cold_start_fatigue).toBe(false);
    expect(norm.cold_start_fitness).toBe(false);
  });

  it("training block + taper → positive form_score (fresh + adapted)", () => {
    // 30 days at 80 TSS, then 15 days rest
    const entries: DailyTssEntry[] = [];
    for (let i = 44; i >= 0; i--) {
      const d = new Date("2026-03-19T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - i);
      entries.push({
        date: d.toISOString().slice(0, 10),
        total_tss: i >= 15 ? 80 : 0,
      });
    }
    const raw = computeEwma(entries, "2026-03-19");
    const norm = normalizeEwma(raw);

    expect(norm.form_score).toBeGreaterThan(0);
    expect(norm.fatigue_score).toBeLessThan(norm.fitness_score);
  });

  it("recent heavy block → negative form_score (overreached)", () => {
    // 42 days easy, then 7 days very hard
    const entries = [
      ...constantLoad(30, 42, "2026-03-12"),
      ...constantLoad(150, 7, "2026-03-19"),
    ];
    const raw = computeEwma(entries, "2026-03-19");
    const norm = normalizeEwma(raw);

    // Fatigue should exceed fitness → negative form
    expect(norm.form_score).toBeLessThan(0);
  });
});
