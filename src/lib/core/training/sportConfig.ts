/**
 * Sport configuration registry — static lookup tables.
 * No IO, fully testable. Defines how training plans are structured
 * for each sport and race distance category.
 */

import type {
  SportConfig,
  RaceCategoryConfig,
  WeeklyStructure,
  Phase,
} from "./types.js";

// ============================================================================
// Running
// ============================================================================

const RUNNING_WEEKLY_STRUCTURE: WeeklyStructure = {
  slots: [
    { slot: 0, workoutType: "easy",     volumeFraction: 0.15, baseIntensity: 4 },
    { slot: 1, workoutType: "tempo",    volumeFraction: 0.20, baseIntensity: 7 },
    { slot: 2, workoutType: "easy",     volumeFraction: 0.12, baseIntensity: 4 },
    { slot: 3, workoutType: "interval", volumeFraction: 0.15, baseIntensity: 8 },
    { slot: 4, workoutType: "easy",     volumeFraction: 0.08, baseIntensity: 3 },
    { slot: 5, workoutType: "long",     volumeFraction: 0.30, baseIntensity: 5 },
  ],
};

const RUNNING_CATEGORIES: RaceCategoryConfig[] = [
  {
    category: "sprint",
    label: "5K",
    minDistanceKm: 5,
    maxDistanceKm: 5,
    minPlanWeeks: 8,
    maxPlanWeeks: 12,
    peakVolumeMultiplier: 7,
    maxPeakVolumeKm: 50,
    phaseRatios: { base: 0.25, build: 0.35, peak: 0.25, taper: 0.15 },
    recoveryWeekCadence: 3,
  },
  {
    category: "short",
    label: "10K",
    minDistanceKm: 10,
    maxDistanceKm: 10,
    minPlanWeeks: 10,
    maxPlanWeeks: 14,
    peakVolumeMultiplier: 5,
    maxPeakVolumeKm: 65,
    phaseRatios: { base: 0.25, build: 0.35, peak: 0.25, taper: 0.15 },
    recoveryWeekCadence: 3,
  },
  {
    category: "medium",
    label: "Half Marathon",
    minDistanceKm: 21.1,
    maxDistanceKm: 21.1,
    minPlanWeeks: 12,
    maxPlanWeeks: 16,
    peakVolumeMultiplier: 2.8,
    maxPeakVolumeKm: 80,
    phaseRatios: { base: 0.25, build: 0.30, peak: 0.25, taper: 0.20 },
    recoveryWeekCadence: 3,
  },
  {
    category: "long",
    label: "Marathon",
    minDistanceKm: 42.2,
    maxDistanceKm: 42.2,
    minPlanWeeks: 14,
    maxPlanWeeks: 20,
    peakVolumeMultiplier: 1.8,
    maxPeakVolumeKm: 100,
    phaseRatios: { base: 0.25, build: 0.30, peak: 0.25, taper: 0.20 },
    recoveryWeekCadence: 3,
  },
  {
    category: "ultra",
    label: "Ultra Marathon",
    minDistanceKm: 50,
    maxDistanceKm: 200,
    minPlanWeeks: 16,
    maxPlanWeeks: 24,
    peakVolumeMultiplier: 1.2,
    maxPeakVolumeKm: 120,
    phaseRatios: { base: 0.25, build: 0.30, peak: 0.25, taper: 0.20 },
    recoveryWeekCadence: 3,
  },
];

// ============================================================================
// Cycling
// ============================================================================

const CYCLING_WEEKLY_STRUCTURE: WeeklyStructure = {
  slots: [
    { slot: 0, workoutType: "easy",      volumeFraction: 0.12, baseIntensity: 3 },
    { slot: 1, workoutType: "interval",  volumeFraction: 0.15, baseIntensity: 8 },
    { slot: 2, workoutType: "easy",      volumeFraction: 0.10, baseIntensity: 3 },
    { slot: 3, workoutType: "tempo",     volumeFraction: 0.18, baseIntensity: 7 },
    { slot: 4, workoutType: "strength",  volumeFraction: 0.05, baseIntensity: 6 },
    { slot: 5, workoutType: "endurance", volumeFraction: 0.40, baseIntensity: 4 },
  ],
};

const CYCLING_CATEGORIES: RaceCategoryConfig[] = [
  {
    category: "medium",
    label: "Gran Fondo (100km)",
    minDistanceKm: 80,
    maxDistanceKm: 120,
    minPlanWeeks: 12,
    maxPlanWeeks: 16,
    peakVolumeMultiplier: 2.5,
    maxPeakVolumeKm: 300,
    phaseRatios: { base: 0.25, build: 0.30, peak: 0.25, taper: 0.20 },
    recoveryWeekCadence: 3,
  },
  {
    category: "long",
    label: "Century / Sportive (200km+)",
    minDistanceKm: 160,
    maxDistanceKm: 300,
    minPlanWeeks: 14,
    maxPlanWeeks: 20,
    peakVolumeMultiplier: 1.5,
    maxPeakVolumeKm: 500,
    phaseRatios: { base: 0.25, build: 0.30, peak: 0.25, taper: 0.20 },
    recoveryWeekCadence: 3,
  },
];

// ============================================================================
// Triathlon
// ============================================================================

const TRIATHLON_WEEKLY_STRUCTURE: WeeklyStructure = {
  slots: [
    { slot: 0, workoutType: "swim_drill", volumeFraction: 0.10, baseIntensity: 5 },
    { slot: 1, workoutType: "tempo",      volumeFraction: 0.15, baseIntensity: 7 },
    { slot: 2, workoutType: "endurance",  volumeFraction: 0.20, baseIntensity: 4 },
    { slot: 3, workoutType: "interval",   volumeFraction: 0.15, baseIntensity: 8 },
    { slot: 4, workoutType: "easy",       volumeFraction: 0.10, baseIntensity: 3 },
    { slot: 5, workoutType: "brick",      volumeFraction: 0.20, baseIntensity: 6 },
    { slot: 6, workoutType: "long",       volumeFraction: 0.10, baseIntensity: 5 },
  ],
};

const TRIATHLON_CATEGORIES: RaceCategoryConfig[] = [
  {
    category: "sprint",
    label: "Sprint Triathlon",
    minDistanceKm: 25.75, // 750m + 20km + 5km
    maxDistanceKm: 25.75,
    minPlanWeeks: 10,
    maxPlanWeeks: 14,
    peakVolumeMultiplier: 3.0,
    maxPeakVolumeKm: 80,
    phaseRatios: { base: 0.25, build: 0.35, peak: 0.25, taper: 0.15 },
    recoveryWeekCadence: 3,
  },
  {
    category: "medium",
    label: "Olympic Triathlon",
    minDistanceKm: 51.5, // 1.5km + 40km + 10km
    maxDistanceKm: 51.5,
    minPlanWeeks: 12,
    maxPlanWeeks: 16,
    peakVolumeMultiplier: 2.0,
    maxPeakVolumeKm: 120,
    phaseRatios: { base: 0.25, build: 0.30, peak: 0.25, taper: 0.20 },
    recoveryWeekCadence: 3,
  },
  {
    category: "long",
    label: "Half Ironman (70.3)",
    minDistanceKm: 113, // 1.9km + 90km + 21.1km
    maxDistanceKm: 113,
    minPlanWeeks: 16,
    maxPlanWeeks: 20,
    peakVolumeMultiplier: 1.2,
    maxPeakVolumeKm: 180,
    phaseRatios: { base: 0.25, build: 0.30, peak: 0.25, taper: 0.20 },
    recoveryWeekCadence: 3,
  },
  {
    category: "ultra",
    label: "Ironman",
    minDistanceKm: 226, // 3.8km + 180km + 42.2km
    maxDistanceKm: 226,
    minPlanWeeks: 20,
    maxPlanWeeks: 30,
    peakVolumeMultiplier: 0.8,
    maxPeakVolumeKm: 250,
    phaseRatios: { base: 0.25, build: 0.30, peak: 0.25, taper: 0.20 },
    recoveryWeekCadence: 4,
  },
];

// ============================================================================
// Registry
// ============================================================================

export const SPORT_CONFIGS: SportConfig[] = [
  {
    sport: "running",
    label: "Running",
    categories: RUNNING_CATEGORIES,
    weeklyStructure: RUNNING_WEEKLY_STRUCTURE,
  },
  {
    sport: "cycling",
    label: "Cycling",
    categories: CYCLING_CATEGORIES,
    weeklyStructure: CYCLING_WEEKLY_STRUCTURE,
  },
  {
    sport: "triathlon",
    label: "Triathlon",
    categories: TRIATHLON_CATEGORIES,
    weeklyStructure: TRIATHLON_WEEKLY_STRUCTURE,
  },
];

// ============================================================================
// Lookups
// ============================================================================

export function getSportConfig(sport: string): SportConfig | null {
  return SPORT_CONFIGS.find((c) => c.sport === sport) ?? null;
}

export function getRaceCategoryConfig(
  sport: string,
  category: string,
): RaceCategoryConfig | null {
  const sc = getSportConfig(sport);
  if (!sc) return null;
  return sc.categories.find((c) => c.category === category) ?? null;
}

/**
 * Auto-detect race category from sport + distance.
 */
export function detectRaceCategory(
  sport: string,
  distanceKm: number,
): RaceCategoryConfig | null {
  const sc = getSportConfig(sport);
  if (!sc) return null;

  // Find the best-fitting category by distance
  let best: RaceCategoryConfig | null = null;
  let bestDiff = Infinity;

  for (const cat of sc.categories) {
    const mid = (cat.minDistanceKm + cat.maxDistanceKm) / 2;
    const diff = Math.abs(distanceKm - mid);
    // Distance must be within reasonable range (within 50% of category range)
    const range = cat.maxDistanceKm - cat.minDistanceKm || cat.minDistanceKm;
    if (diff <= range * 0.75 + 5 && diff < bestDiff) {
      bestDiff = diff;
      best = cat;
    }
  }

  // Fallback: if distance exceeds all categories, use the largest
  if (!best && sc.categories.length > 0) {
    const largest = sc.categories[sc.categories.length - 1];
    if (distanceKm >= largest.minDistanceKm) {
      best = largest;
    }
  }

  return best;
}

// ============================================================================
// Phase intensity modifiers
// ============================================================================

/**
 * How intensity is scaled per phase (multiplier on base intensity).
 * Base phase = lower intensity, build/peak = higher, taper = moderate.
 */
export const PHASE_INTENSITY_MODIFIER: Record<Phase, number> = {
  base: 0.85,
  build: 1.0,
  peak: 1.1,
  taper: 0.80,
  recovery: 0.65,
};

/**
 * Volume multiplier pattern within each phase.
 * Returns the progression multiplier for a given week within a phase.
 * Ramps up linearly across the phase.
 */
export function phaseWeekProgression(
  weekInPhase: number,
  totalWeeksInPhase: number,
): number {
  if (totalWeeksInPhase <= 1) return 1.0;
  // Linear ramp: first week = 0.85, last week = 1.0
  const t = weekInPhase / (totalWeeksInPhase - 1);
  return 0.85 + t * 0.15;
}

/**
 * Taper volume curve — exponential decay.
 * Week 1 of taper = ~70%, week 2 = ~55%, week 3 = ~40%.
 */
export function taperMultiplier(
  weekInTaper: number,
  totalTaperWeeks: number,
): number {
  // Exponential decay from 0.70 to 0.35
  const t = weekInTaper / Math.max(totalTaperWeeks - 1, 1);
  return 0.70 * Math.pow(0.50, t);
}
