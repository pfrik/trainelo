/**
 * Periodization engine — generates a week-by-week training plan.
 * Pure function: no IO, no DB, fully testable.
 */

import type {
  GoalInput,
  PeriodizationResult,
  PhaseBlock,
  WeekPlan,
  DaySlot,
  Phase,
  WorkoutType,
} from "./types.js";
import {
  getRaceCategoryConfig,
  detectRaceCategory,
  PHASE_INTENSITY_MODIFIER,
  phaseWeekProgression,
  taperMultiplier,
} from "./sportConfig.js";

// ============================================================================
// Main entry point
// ============================================================================

export function periodize(input: GoalInput): PeriodizationResult {
  const {
    sport,
    raceCategory,
    raceDistanceKm,
    raceDateIso,
    currentDateIso,
    currentWeeklyVolumeKm,
    trainingDaysPerWeek,
  } = input;

  // 1. Resolve sport + category config
  const catConfig =
    getRaceCategoryConfig(sport, raceCategory) ??
    detectRaceCategory(sport, raceDistanceKm);

  if (!catConfig) {
    throw new Error(
      `No sport config found for ${sport} / ${raceCategory} / ${raceDistanceKm}km`,
    );
  }

  // 2. Compute total weeks available
  const raceDate = new Date(raceDateIso);
  const currentDate = new Date(currentDateIso);
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const rawWeeks = Math.floor(
    (raceDate.getTime() - currentDate.getTime()) / msPerWeek,
  );
  const totalWeeks = Math.max(
    catConfig.minPlanWeeks,
    Math.min(rawWeeks, catConfig.maxPlanWeeks),
  );

  // 3. Compute peak weekly volume
  const rawPeakVolume = raceDistanceKm * catConfig.peakVolumeMultiplier;
  let peakWeeklyVolumeKm = Math.min(rawPeakVolume, catConfig.maxPeakVolumeKm);

  // Safe progression cap: peak volume should be reachable with ~10% weekly increase
  // from current volume over the available weeks
  if (currentWeeklyVolumeKm > 0) {
    const maxReachable =
      currentWeeklyVolumeKm * Math.pow(1.1, totalWeeks * 0.6);
    peakWeeklyVolumeKm = Math.min(peakWeeklyVolumeKm, maxReachable);
    // Floor: at least current volume + 20%
    peakWeeklyVolumeKm = Math.max(
      peakWeeklyVolumeKm,
      currentWeeklyVolumeKm * 1.2,
    );
  }

  // Round for cleanliness
  peakWeeklyVolumeKm = Math.round(peakWeeklyVolumeKm);

  // 4. Allocate phases
  const phases = allocatePhases(totalWeeks, catConfig.phaseRatios);

  // 5. Generate week plans
  const weeks = generateWeekPlans(
    phases,
    totalWeeks,
    peakWeeklyVolumeKm,
    currentWeeklyVolumeKm,
    trainingDaysPerWeek,
    sport,
    raceDateIso,
    currentDateIso,
    catConfig.recoveryWeekCadence,
  );

  return {
    totalWeeks,
    peakWeeklyVolumeKm,
    phases,
    weeks,
  };
}

// ============================================================================
// Phase allocation
// ============================================================================

function allocatePhases(
  totalWeeks: number,
  phaseRatios: Record<Exclude<Phase, "recovery">, number>,
): PhaseBlock[] {
  const phases: PhaseBlock[] = [];
  let weekCursor = 1;

  const orderedPhases: Array<{
    phase: Phase;
    ratio: number;
    desc: string;
  }> = [
    { phase: "base", ratio: phaseRatios.base, desc: "Aerobic foundation — build endurance base" },
    { phase: "build", ratio: phaseRatios.build, desc: "Increase intensity — tempo and intervals" },
    { phase: "peak", ratio: phaseRatios.peak, desc: "Race-specific preparation — highest load" },
    { phase: "taper", ratio: phaseRatios.taper, desc: "Volume reduction — sharpen for race day" },
  ];

  for (let i = 0; i < orderedPhases.length; i++) {
    const { phase, ratio, desc } = orderedPhases[i];
    const isLast = i === orderedPhases.length - 1;
    const phaseWeeks = isLast
      ? totalWeeks - weekCursor + 1 // last phase gets remainder
      : Math.max(1, Math.round(totalWeeks * ratio));

    phases.push({
      phase,
      startWeek: weekCursor,
      endWeek: weekCursor + phaseWeeks - 1,
      description: desc,
    });

    weekCursor += phaseWeeks;
  }

  return phases;
}

// ============================================================================
// Week plan generation
// ============================================================================

function generateWeekPlans(
  phases: PhaseBlock[],
  totalWeeks: number,
  peakVolumeKm: number,
  currentVolumeKm: number,
  trainingDays: number,
  sport: string,
  raceDateIso: string,
  currentDateIso: string,
  recoveryWeekCadence: number,
): WeekPlan[] {
  const weeks: WeekPlan[] = [];
  const raceDate = new Date(raceDateIso);
  let hardWeekStreak = 0;

  for (let w = 1; w <= totalWeeks; w++) {
    const phase = getPhaseForWeek(w, phases);
    const phaseBlock = phases.find((p) => w >= p.startWeek && w <= p.endWeek)!;
    const weekInPhase = w - phaseBlock.startWeek;
    const phaseLength = phaseBlock.endWeek - phaseBlock.startWeek + 1;

    // Determine if this is a recovery week
    hardWeekStreak++;
    const isRecovery =
      phase !== "taper" &&
      phase !== "recovery" &&
      hardWeekStreak >= recoveryWeekCadence;

    if (isRecovery) {
      hardWeekStreak = 0;
    }

    // Compute volume multiplier
    let volumeMultiplier: number;
    if (isRecovery) {
      volumeMultiplier = 0.60;
    } else if (phase === "taper") {
      volumeMultiplier = taperMultiplier(weekInPhase, phaseLength);
    } else {
      // Progressive build within phase
      const baseMultiplier = getPhaseBaseMultiplier(phase);
      const progression = phaseWeekProgression(weekInPhase, phaseLength);
      volumeMultiplier = baseMultiplier * progression;
    }

    // First week safety: don't exceed 110% of current volume
    let weeklyVolumeKm = Math.round(peakVolumeKm * volumeMultiplier);
    if (w === 1 && currentVolumeKm > 0) {
      weeklyVolumeKm = Math.min(
        weeklyVolumeKm,
        Math.round(currentVolumeKm * 1.1),
      );
    }

    // Compute week start date
    const weekStartDate = new Date(raceDate);
    weekStartDate.setDate(
      weekStartDate.getDate() - (totalWeeks - w + 1) * 7,
    );
    const weekStartIso = weekStartDate.toISOString().slice(0, 10);

    // Generate day workouts
    const workouts = generateDaySlots(
      weeklyVolumeKm,
      trainingDays,
      phase,
      isRecovery,
      sport,
    );

    weeks.push({
      weekNumber: w,
      phase: isRecovery ? "recovery" : phase,
      weekStartDate: weekStartIso,
      volumeMultiplier: Math.round(volumeMultiplier * 100) / 100,
      weeklyVolumeKm,
      isRecoveryWeek: isRecovery,
      workouts,
    });
  }

  return weeks;
}

// ============================================================================
// Day slot generation
// ============================================================================

function generateDaySlots(
  weeklyVolumeKm: number,
  trainingDays: number,
  phase: Phase,
  isRecovery: boolean,
  sport: string,
): DaySlot[] {
  const clampedDays = Math.max(3, Math.min(trainingDays, 6));
  const slots: DaySlot[] = [];

  // Build a workout schedule for training days
  const schedule = buildWeeklySchedule(clampedDays, phase, isRecovery, sport);

  // Distribute volume across workouts
  const totalFraction = schedule.reduce((sum, s) => sum + s.volumeFraction, 0);

  // Map schedule slots to actual days of week (Mon=0 .. Sun=6)
  // Distribute training days evenly across the week with rest days interspersed
  const trainingDayIndices = distributeTrainingDays(clampedDays);

  for (let i = 0; i < schedule.length; i++) {
    const sched = schedule[i];
    const dayOfWeek = trainingDayIndices[i] ?? i;

    const distanceKm =
      sched.workoutType === "strength" || sched.workoutType === "mobility"
        ? null
        : Math.round(
            (weeklyVolumeKm * sched.volumeFraction) / totalFraction,
          );

    // Estimate duration from distance (rough: ~6 min/km for easy, ~5 for tempo, ~4.5 for intervals)
    const paceMinPerKm = getPaceForType(sched.workoutType);
    const durationMinutes =
      distanceKm != null
        ? Math.round(distanceKm * paceMinPerKm)
        : sched.workoutType === "strength"
          ? 45
          : 20; // mobility

    // Adjust intensity for phase
    const intensityMod = PHASE_INTENSITY_MODIFIER[phase] ?? 1.0;
    const intensity = Math.max(
      1,
      Math.min(10, Math.round(sched.baseIntensity * intensityMod)),
    );

    const sportPrefix = getSportPrefix(sport, sched.workoutType);
    const templateRef = `${sportPrefix}-${sched.workoutType}-${durationMinutes}min`;

    slots.push({
      dayOfWeek,
      templateRef,
      workoutType: sched.workoutType,
      durationMinutes,
      distanceKm,
      intensityLevel: intensity,
      description: buildDescription(sched.workoutType, phase, distanceKm, durationMinutes),
    });
  }

  return slots;
}

// ============================================================================
// Weekly schedule builder
// ============================================================================

interface ScheduleSlot {
  workoutType: WorkoutType;
  volumeFraction: number;
  baseIntensity: number;
}

function buildWeeklySchedule(
  trainingDays: number,
  phase: Phase,
  isRecovery: boolean,
  sport: string,
): ScheduleSlot[] {
  if (isRecovery) {
    return buildRecoverySchedule(trainingDays, sport);
  }

  const slots: ScheduleSlot[] = [];

  // Always include a long run/ride (biggest session)
  slots.push({
    workoutType: sport === "cycling" ? "endurance" : "long",
    volumeFraction: 0.30,
    baseIntensity: 5,
  });

  // Key session 1: tempo or threshold (build/peak phases get higher intensity)
  if (phase === "build" || phase === "peak") {
    slots.push({
      workoutType: "tempo",
      volumeFraction: 0.20,
      baseIntensity: 7,
    });
  }

  // Key session 2: intervals (peak phase emphasis)
  if (phase === "peak" && trainingDays >= 4) {
    slots.push({
      workoutType: "interval",
      volumeFraction: 0.15,
      baseIntensity: 8,
    });
  } else if (phase === "build" && trainingDays >= 5) {
    slots.push({
      workoutType: "interval",
      volumeFraction: 0.15,
      baseIntensity: 8,
    });
  }

  // Base phase: more easy volume, maybe a tempo
  if (phase === "base") {
    slots.push({
      workoutType: "tempo",
      volumeFraction: 0.18,
      baseIntensity: 6,
    });
  }

  // Triathlon brick session in build/peak
  if (sport === "triathlon" && (phase === "build" || phase === "peak") && trainingDays >= 5) {
    slots.push({
      workoutType: "brick",
      volumeFraction: 0.18,
      baseIntensity: 6,
    });
  }

  // Fill remaining days with easy sessions
  while (slots.length < trainingDays) {
    slots.push({
      workoutType: "easy",
      volumeFraction: 0.12,
      baseIntensity: 4,
    });
  }

  // Trim if we generated too many
  return slots.slice(0, trainingDays);
}

function buildRecoverySchedule(
  trainingDays: number,
  _sport: string,
): ScheduleSlot[] {
  const slots: ScheduleSlot[] = [];
  const days = Math.min(trainingDays, 4); // recovery weeks: max 4 days

  // One moderate-length easy run/ride
  slots.push({
    workoutType: "easy",
    volumeFraction: 0.30,
    baseIntensity: 3,
  });

  // One shorter easy session
  if (days >= 2) {
    slots.push({
      workoutType: "easy",
      volumeFraction: 0.25,
      baseIntensity: 3,
    });
  }

  // Mobility or recovery
  if (days >= 3) {
    slots.push({
      workoutType: "mobility",
      volumeFraction: 0.05,
      baseIntensity: 2,
    });
  }

  // One more easy if 4 days
  if (days >= 4) {
    slots.push({
      workoutType: "recovery",
      volumeFraction: 0.20,
      baseIntensity: 2,
    });
  }

  return slots;
}

// ============================================================================
// Helpers
// ============================================================================

function getPhaseForWeek(week: number, phases: PhaseBlock[]): Phase {
  for (const p of phases) {
    if (week >= p.startWeek && week <= p.endWeek) return p.phase;
  }
  return "base";
}

function getPhaseBaseMultiplier(phase: Phase): number {
  switch (phase) {
    case "base":
      return 0.65;
    case "build":
      return 0.80;
    case "peak":
      return 0.95;
    case "taper":
      return 0.50; // handled separately
    case "recovery":
      return 0.55;
  }
}

function distributeTrainingDays(trainingDays: number): number[] {
  // Spread training days across Mon-Sun (0-6) with rest days distributed evenly
  // Always rest on Sunday (6) if possible
  const allDays = [0, 1, 2, 3, 4, 5, 6]; // Mon-Sun
  if (trainingDays >= 7) return allDays;

  // Common patterns
  const patterns: Record<number, number[]> = {
    3: [0, 2, 5],          // Mon, Wed, Sat
    4: [0, 2, 4, 5],       // Mon, Wed, Fri, Sat
    5: [0, 1, 3, 4, 5],    // Mon, Tue, Thu, Fri, Sat
    6: [0, 1, 2, 3, 4, 5], // Mon-Sat
  };

  return patterns[trainingDays] ?? allDays.slice(0, trainingDays);
}

function getPaceForType(workoutType: WorkoutType): number {
  switch (workoutType) {
    case "recovery":
      return 7.0;
    case "easy":
      return 6.5;
    case "long":
    case "endurance":
      return 6.0;
    case "tempo":
      return 5.0;
    case "interval":
      return 4.5;
    case "hill":
      return 5.5;
    case "brick":
      return 5.5;
    default:
      return 6.0;
  }
}

function getSportPrefix(sport: string, workoutType: WorkoutType): string {
  if (workoutType === "strength") return "strength";
  if (workoutType === "mobility") return "mobility";
  if (workoutType === "swim_drill") return "swim";

  switch (sport) {
    case "running":
      return "run";
    case "cycling":
      return "bike";
    case "swimming":
      return "swim";
    case "triathlon":
      // For triathlon, infer from workout type
      // (swim_drill, strength, mobility already handled above)
      if (workoutType === "endurance" || workoutType === "brick") return "bike";
      return "run";
    default:
      return "run";
  }
}

function buildDescription(
  workoutType: WorkoutType,
  phase: Phase,
  distanceKm: number | null,
  durationMinutes: number,
): string {
  const dist = distanceKm != null ? `${distanceKm}km` : "";
  const dur = `${durationMinutes} min`;

  switch (workoutType) {
    case "easy":
      return `Easy ${dist} run (${dur}) — conversational pace, Zone 2`;
    case "recovery":
      return `Recovery jog ${dist} (${dur}) — very easy, Zone 1`;
    case "tempo":
      return `Tempo ${dist} (${dur}) — comfortably hard, Zone 3-4`;
    case "long":
      return `Long run ${dist} (${dur}) — steady aerobic effort, Zone 2`;
    case "interval":
      return `Interval session ${dist} (${dur}) — high intensity repeats, Zone 4-5`;
    case "hill":
      return `Hill repeats ${dist} (${dur}) — strength + power on incline`;
    case "endurance":
      return `Endurance ride ${dist} (${dur}) — steady aerobic, Zone 2`;
    case "brick":
      return `Brick workout (${dur}) — bike-to-run transition practice`;
    case "swim_drill":
      return `Swim drills + main set (${dur}) — technique and endurance`;
    case "strength":
      return `Lower body strength (${dur}) — squats, lunges, core`;
    case "mobility":
      return `Mobility & stretching (${dur}) — hip, thoracic, ankle work`;
    case "rest":
      return "Rest day — full recovery";
  }
}
