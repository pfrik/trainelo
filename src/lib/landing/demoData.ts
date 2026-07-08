/**
 * Demo data for the public landing page.
 *
 * These objects feed the REAL product components (EvidencePanel, recovery
 * ring) so the landing page shows the actual product, not screenshots.
 * Values depict a realistic "slightly worn, train modified" morning —
 * the most honest showcase of what the engine does.
 */

import type { EvidenceSummary } from "@/lib/core/contracts";

/** A believable morning: decent sleep, HRV a touch low, check-in capped. */
export const DEMO_EVIDENCE: EvidenceSummary = {
  fatigue_score: 42,
  fitness_score: 58,
  hrv_trend: "stable",
  sleep_quality: 81,
  days_since_rest: 2,
  confidence: 0.85,
  checkin_mood: "okay",
  checkin_rpe: 6,
  checkin_soreness: 3,
  checkin_readiness_delta: -8,
  signal_contribution: {
    objective_score: 72,
    objective_fatigue: 38,
    objective_components: {
      sleep: 81,
      hrv: 64,
      metrics: 70,
      load_penalty: 6,
      fitness_bonus: 2,
    },
    subjective_delta: -8,
    subjective_delta_raw: -12,
    subjective_fatigue_delta: 4,
    subjective_fatigue_delta_raw: 4,
    final_score: 64,
    final_fatigue: 42,
    conflict_flag: false,
  },
  calibration_level: "amber",
  calibration_intensity_multiplier: 0.85,
  calibration_duration_multiplier: 0.9,
  calibration_headline: "Modified session: soreness noted, HRV slightly below baseline",
  calibration_rationale:
    "Your wearable data supports training, but this morning's check-in reported lingering soreness. Intensity is trimmed so today builds you up instead of digging the hole deeper.",
  calibration_warnings: null,
  confidence_data_availability: 0.92,
  confidence_signal_consistency: 0.81,
  confidence_data_recency: 0.9,
  baseline_mode: "mature",
  ewma_fitness_score: 58,
  ewma_fatigue_score: 46,
  ewma_form_score: -4,
  anomaly_caution_level: "none",
};

/** Seven nights of rMSSD for the hero sparkline (ms). */
export const DEMO_HRV_WEEK: number[] = [52, 48, 55, 51, 44, 47, 49];

export const DEMO_HRV_BASELINE = 51;

/** Hero recommendation card content. */
export const DEMO_RECOMMENDATION = {
  title: "Tempo Run · 42 min",
  badge: "Modified",
  rationale:
    "Readiness is moderate: sleep was solid but your check-in reported soreness. Tempo blocks are kept, intensity trimmed 15%.",
  reasons: ["Check-in: soreness", "HRV below baseline", "2 days since rest"],
  segments: [
    { label: "Warm-up", detail: "10 min · easy" },
    { label: "Tempo", detail: "3 × 8 min · RPE 6-7" },
    { label: "Cool-down", detail: "8 min · easy" },
  ],
};
