/**
 * Core training plan types — pure types, no IO.
 */

// ============================================================================
// Sport & Race
// ============================================================================

export type Sport = "running" | "cycling" | "swimming" | "triathlon";

export type RaceCategory =
  | "sprint"   // 5K run, sprint tri
  | "short"    // 10K run
  | "medium"   // Half marathon, Olympic tri, 100km bike
  | "long"     // Marathon, Half Ironman, 200km+ bike
  | "ultra";   // Ultra marathon, Ironman

export type Phase = "base" | "build" | "peak" | "taper" | "recovery";

export type GoalPriority = "A" | "B" | "C";

// ============================================================================
// Plan Generation Input / Output
// ============================================================================

export interface GoalInput {
  sport: Sport;
  raceCategory: RaceCategory;
  raceDistanceKm: number;
  raceDateIso: string;
  currentDateIso: string;
  targetTimeMinutes: number | null;
  priority: GoalPriority;
  currentWeeklyVolumeKm: number;
  trainingDaysPerWeek: number;
}

export interface PeriodizationResult {
  totalWeeks: number;
  peakWeeklyVolumeKm: number;
  phases: PhaseBlock[];
  weeks: WeekPlan[];
}

export interface PhaseBlock {
  phase: Phase;
  startWeek: number;
  endWeek: number;
  description: string;
}

export interface WeekPlan {
  weekNumber: number;
  phase: Phase;
  weekStartDate: string;
  volumeMultiplier: number;
  weeklyVolumeKm: number;
  isRecoveryWeek: boolean;
  workouts: DaySlot[];
}

export interface DaySlot {
  dayOfWeek: number; // 0=Mon, 6=Sun
  templateRef: string;
  workoutType: WorkoutType;
  durationMinutes: number;
  distanceKm: number | null;
  intensityLevel: number; // 1-10
  description: string;
}

// ============================================================================
// Workout Types
// ============================================================================

export type WorkoutType =
  | "easy"
  | "recovery"
  | "tempo"
  | "long"
  | "interval"
  | "hill"
  | "strength"
  | "mobility"
  | "brick"        // triathlon: bike-to-run
  | "endurance"    // cycling: long steady ride
  | "swim_drill"
  | "rest";

// ============================================================================
// Sport Configuration
// ============================================================================

export interface RaceCategoryConfig {
  category: RaceCategory;
  label: string;
  minDistanceKm: number;
  maxDistanceKm: number;
  minPlanWeeks: number;
  maxPlanWeeks: number;
  /** Peak weekly volume = race distance * this multiplier */
  peakVolumeMultiplier: number;
  /** Absolute cap on peak weekly volume (km) */
  maxPeakVolumeKm: number;
  /** Phase allocation as fraction of total weeks */
  phaseRatios: Record<Exclude<Phase, "recovery">, number>;
  /** Recovery week cadence: insert recovery every N hard weeks */
  recoveryWeekCadence: number;
}

export interface WeeklyStructure {
  /** Template for distributing workouts across training days */
  slots: WeekSlotTemplate[];
}

export interface WeekSlotTemplate {
  /** Which training day (0 = first training day, etc.) */
  slot: number;
  /** Workout type for this slot */
  workoutType: WorkoutType;
  /** Fraction of weekly volume for this workout */
  volumeFraction: number;
  /** Base intensity level (1-10), adjusted by phase */
  baseIntensity: number;
}

export interface SportConfig {
  sport: Sport;
  label: string;
  categories: RaceCategoryConfig[];
  weeklyStructure: WeeklyStructure;
}

// ============================================================================
// Scheduled Workout Resolution (Pipeline Bridge)
// ============================================================================

export interface ScheduledWorkoutResult {
  has_scheduled_workout: boolean;
  scheduled_template_ref: string | null;
  goal_context: GoalContext | null;
}

export interface GoalContext {
  goal_id: string;
  goal_title: string;
  phase: Phase;
  week_number: number;
  days_until_race: number;
}
