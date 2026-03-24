/**
 * Dynamic workout template factory.
 * Generates WorkoutTemplate objects from a templateRef naming convention.
 * Compatible with the existing resolveTemplate → applyCalibratedTemplate pipeline.
 *
 * Naming convention: {sport}-{type}-{duration}min
 * Examples: run-tempo-45min, bike-endurance-90min, swim-intervals-40min
 */

import type {
  WorkoutTemplate,
  WorkoutSegment,
  WorkoutSet,
} from "../templates/workoutTemplates.js";

// ============================================================================
// Public API
// ============================================================================

/**
 * Parse a templateRef string and build a WorkoutTemplate.
 * Returns null if the ref doesn't match the expected naming convention.
 */
export function buildTemplateFromRef(
  templateRef: string,
): WorkoutTemplate | null {
  const parsed = parseTemplateRef(templateRef);
  if (!parsed) return null;

  const { sport, type, durationMinutes } = parsed;
  const segments = buildSegments(sport, type, durationMinutes);
  const rpeTarget = RPE_BY_TYPE[type] ?? 5;
  const templateType = mapToTemplateType(type);
  const targetKm = estimateTargetKm(sport, type, durationMinutes);

  return {
    template_ref: templateRef,
    label: buildLabel(sport, type, durationMinutes),
    type: templateType,
    total_duration_minutes: durationMinutes,
    segments,
    target_km: targetKm,
    description: buildTemplateDescription(sport, type, durationMinutes, targetKm),
    rpe_target: rpeTarget,
  };
}

// ============================================================================
// Parser
// ============================================================================

interface ParsedRef {
  sport: string;
  type: string;
  durationMinutes: number;
}

function parseTemplateRef(ref: string): ParsedRef | null {
  // Match: {sport}-{type}-{duration}min
  const match = ref.match(/^(\w+)-(\w+)-(\d+)min$/);
  if (!match) return null;

  const [, sport, type, durStr] = match;
  const durationMinutes = parseInt(durStr, 10);
  if (isNaN(durationMinutes) || durationMinutes < 5 || durationMinutes > 300) {
    return null;
  }

  return { sport, type, durationMinutes };
}

// ============================================================================
// Segment builders
// ============================================================================

interface SegmentSplit {
  warmupFraction: number;
  mainFraction: number;
  cooldownFraction: number;
}

const SEGMENT_SPLITS: Record<string, SegmentSplit> = {
  easy:       { warmupFraction: 0.10, mainFraction: 0.80, cooldownFraction: 0.10 },
  recovery:   { warmupFraction: 0.10, mainFraction: 0.80, cooldownFraction: 0.10 },
  tempo:      { warmupFraction: 0.15, mainFraction: 0.70, cooldownFraction: 0.15 },
  long:       { warmupFraction: 0.05, mainFraction: 0.90, cooldownFraction: 0.05 },
  endurance:  { warmupFraction: 0.05, mainFraction: 0.90, cooldownFraction: 0.05 },
  interval:   { warmupFraction: 0.15, mainFraction: 0.65, cooldownFraction: 0.20 },
  hill:       { warmupFraction: 0.15, mainFraction: 0.65, cooldownFraction: 0.20 },
  brick:      { warmupFraction: 0.10, mainFraction: 0.80, cooldownFraction: 0.10 },
  swim_drill: { warmupFraction: 0.15, mainFraction: 0.70, cooldownFraction: 0.15 },
  strength:   { warmupFraction: 0.15, mainFraction: 0.70, cooldownFraction: 0.15 },
  mobility:   { warmupFraction: 0.10, mainFraction: 0.80, cooldownFraction: 0.10 },
};

function buildSegments(
  sport: string,
  type: string,
  totalMinutes: number,
): WorkoutSegment[] {
  const split = SEGMENT_SPLITS[type] ?? SEGMENT_SPLITS.easy;

  const warmupMin = Math.max(3, Math.round(totalMinutes * split.warmupFraction));
  const cooldownMin = Math.max(2, Math.round(totalMinutes * split.cooldownFraction));
  const mainMin = totalMinutes - warmupMin - cooldownMin;

  const intensityMap = getIntensityMap(type);

  return [
    {
      type: "warmup",
      duration_minutes: warmupMin,
      description: buildSegmentDescription("warmup", sport, type),
      target_intensity: intensityMap.warmup,
      sets: buildSets("warmup", sport, type, warmupMin),
    },
    {
      type: "main",
      duration_minutes: mainMin,
      description: buildSegmentDescription("main", sport, type),
      target_intensity: intensityMap.main,
      sets: buildSets("main", sport, type, mainMin),
    },
    {
      type: "cooldown",
      duration_minutes: cooldownMin,
      description: buildSegmentDescription("cooldown", sport, type),
      target_intensity: intensityMap.cooldown,
      sets: buildSets("cooldown", sport, type, cooldownMin),
    },
  ];
}

// ============================================================================
// Intensity mapping
// ============================================================================

interface IntensityProfile {
  warmup: number;
  main: number;
  cooldown: number;
}

function getIntensityMap(type: string): IntensityProfile {
  switch (type) {
    case "recovery":
      return { warmup: 30, main: 40, cooldown: 30 };
    case "easy":
      return { warmup: 40, main: 55, cooldown: 35 };
    case "long":
    case "endurance":
      return { warmup: 40, main: 60, cooldown: 35 };
    case "tempo":
      return { warmup: 45, main: 75, cooldown: 35 };
    case "interval":
      return { warmup: 45, main: 85, cooldown: 30 };
    case "hill":
      return { warmup: 45, main: 80, cooldown: 30 };
    case "brick":
      return { warmup: 40, main: 65, cooldown: 35 };
    case "strength":
      return { warmup: 40, main: 70, cooldown: 25 };
    case "mobility":
      return { warmup: 20, main: 30, cooldown: 15 };
    default:
      return { warmup: 40, main: 55, cooldown: 35 };
  }
}

const RPE_BY_TYPE: Record<string, number> = {
  recovery: 2,
  easy: 4,
  long: 5,
  endurance: 5,
  tempo: 7,
  interval: 8,
  hill: 8,
  brick: 6,
  swim_drill: 5,
  strength: 6,
  mobility: 2,
};

// ============================================================================
// Set/description builders
// ============================================================================

function buildSets(
  segmentType: "warmup" | "main" | "cooldown",
  sport: string,
  workoutType: string,
  minutes: number,
): WorkoutSet[] {
  if (segmentType === "warmup") {
    return [
      {
        duration_display: `${minutes} min`,
        intensity_label: "Easy",
        description:
          sport === "swim"
            ? "Easy swimming with stroke drills"
            : `Easy ${sport === "bike" ? "spinning" : "jogging"} to warm up`,
      },
    ];
  }

  if (segmentType === "cooldown") {
    return [
      {
        duration_display: `${minutes} min`,
        intensity_label: "Easy",
        description:
          sport === "swim"
            ? "Easy backstroke cool down"
            : `Easy ${sport === "bike" ? "spinning" : "jogging"}, then stretch`,
      },
    ];
  }

  // Main segment — type-specific
  switch (workoutType) {
    case "interval":
      return buildIntervalSets(sport, minutes);
    case "tempo":
      return [
        {
          duration_display: `${minutes} min`,
          intensity_label: "Threshold",
          description: `Steady ${sport === "bike" ? "effort at threshold" : "tempo pace"} — comfortably hard`,
        },
      ];
    case "hill":
      return [
        {
          duration_display: `${minutes} min`,
          intensity_label: "Hard",
          description: `Hill repeats: hard uphill, easy jog down. ${Math.floor(minutes / 5)} repeats`,
        },
      ];
    case "strength":
      return buildStrengthSets(minutes);
    case "brick":
      return [
        {
          duration_display: `${Math.round(minutes * 0.6)} min`,
          intensity_label: "Moderate",
          description: "Bike segment at moderate effort",
        },
        {
          duration_display: `${Math.round(minutes * 0.4)} min`,
          intensity_label: "Moderate",
          description: "Run off the bike — focus on finding rhythm",
        },
      ];
    default:
      return [
        {
          duration_display: `${minutes} min`,
          intensity_label: workoutType === "recovery" ? "Very Easy" : "Easy",
          description:
            workoutType === "long" || workoutType === "endurance"
              ? "Steady aerobic effort — conversational pace"
              : workoutType === "mobility"
                ? "Dynamic stretching: hip circles, thoracic rotation, ankle mobility, cat-cow"
                : `Easy, relaxed ${sport === "bike" ? "ride" : sport === "swim" ? "swim" : "run"}`,
        },
      ];
  }
}

function buildIntervalSets(sport: string, minutes: number): WorkoutSet[] {
  // Estimate number of intervals based on duration
  // ~2-3 min per interval including rest
  const numIntervals = Math.max(4, Math.min(12, Math.floor(minutes / 3)));
  const workSeconds = Math.round((minutes * 60 * 0.6) / numIntervals);
  const restSeconds = Math.round((minutes * 60 * 0.4) / numIntervals);

  return [
    {
      duration_display: `${numIntervals} x ${Math.round(workSeconds / 60)} min`,
      intensity_label: "Hard",
      description:
        sport === "bike"
          ? `${numIntervals} intervals at VO2max effort, ${Math.round(restSeconds / 60)} min easy between`
          : sport === "swim"
            ? `${numIntervals} x ${Math.round(workSeconds / 60 * 100)}m fast, ${restSeconds}s rest`
            : `${numIntervals} repeats at 5K effort, ${Math.round(restSeconds / 60)} min jog recovery`,
    },
  ];
}

function buildStrengthSets(minutes: number): WorkoutSet[] {
  const sets = minutes >= 40 ? 3 : 2;
  return [
    {
      duration_display: `${sets}x10`,
      intensity_label: "Moderate",
      description: "Squats / goblet squats",
    },
    {
      duration_display: `${sets}x10/side`,
      intensity_label: "Moderate",
      description: "Bulgarian split squats",
    },
    {
      duration_display: `${sets}x12`,
      intensity_label: "Moderate",
      description: "Romanian deadlifts",
    },
    {
      duration_display: `${sets}x15`,
      intensity_label: "Moderate",
      description: "Calf raises",
    },
  ];
}

// ============================================================================
// Label & description helpers
// ============================================================================

function mapToTemplateType(
  type: string,
): WorkoutTemplate["type"] {
  switch (type) {
    case "easy":
      return "easy";
    case "recovery":
      return "recovery";
    case "tempo":
      return "tempo";
    case "long":
    case "endurance":
      return "long";
    case "interval":
    case "hill":
      return "interval";
    case "strength":
      return "strength";
    case "mobility":
      return "mobility";
    // Fallback for types not in the original enum
    case "brick":
    case "swim_drill":
      return "tempo";
    default:
      return "easy";
  }
}

function buildLabel(sport: string, type: string, minutes: number): string {
  const sportLabel = sport.charAt(0).toUpperCase() + sport.slice(1);
  const typeLabel = TYPE_LABELS[type] ?? type.charAt(0).toUpperCase() + type.slice(1);
  return `${sportLabel} ${typeLabel} (${minutes} min)`;
}

const TYPE_LABELS: Record<string, string> = {
  easy: "Easy",
  recovery: "Recovery",
  tempo: "Tempo",
  long: "Long Run",
  endurance: "Endurance Ride",
  interval: "Intervals",
  hill: "Hill Repeats",
  brick: "Brick",
  swim_drill: "Swim Drills",
  strength: "Strength",
  mobility: "Mobility",
};

function buildTemplateDescription(
  sport: string,
  type: string,
  minutes: number,
  targetKm: number | null,
): string {
  const dist = targetKm != null ? ` — ~${targetKm}km` : "";
  const typeDesc = TYPE_LABELS[type] ?? type;
  return `${typeDesc} session${dist} (${minutes} min)`;
}

function buildSegmentDescription(
  segment: "warmup" | "main" | "cooldown",
  _sport: string,
  workoutType: string,
): string {
  switch (segment) {
    case "warmup":
      return "Gradual warm-up to prepare for the session";
    case "main":
      return TYPE_LABELS[workoutType] ?? "Main session";
    case "cooldown":
      return "Easy cool-down and stretching";
  }
}

function estimateTargetKm(
  sport: string,
  type: string,
  minutes: number,
): number | null {
  if (type === "strength" || type === "mobility") return null;

  // Rough pace estimates (min/km)
  const paceMap: Record<string, Record<string, number>> = {
    run: {
      recovery: 7.0,
      easy: 6.5,
      long: 6.0,
      tempo: 5.0,
      interval: 4.5,
      hill: 5.5,
    },
    bike: {
      easy: 2.0,
      endurance: 2.0,
      tempo: 1.7,
      interval: 1.5,
    },
    swim: {
      easy: 30.0, // min/km in water
      swim_drill: 28.0,
      interval: 25.0,
    },
  };

  const sportPaces = paceMap[sport] ?? paceMap.run;
  const pace = sportPaces[type] ?? 6.0;
  return Math.round((minutes / pace) * 10) / 10;
}
