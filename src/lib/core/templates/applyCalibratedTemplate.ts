/**
 * Apply calibration multipliers to a workout template.
 * Scales durations and records intensity adjustment for UI display.
 */

import type { WorkoutTemplate, WorkoutSegment } from "./workoutTemplates.js";

// ============================================================================
// Types
// ============================================================================

export interface CalibratedSegment {
  type: WorkoutSegment["type"];
  duration_minutes: number;
  description: string;
  target_intensity: number | null;
  sets: WorkoutSegment["sets"];
}

export interface CalibratedWorkout {
  template_ref: string;
  label: string;
  type: WorkoutTemplate["type"];
  total_duration_minutes: number;
  segments: CalibratedSegment[];
  target_km: number | null;
  description: string;
  rpe_target: number;
  intensity_multiplier: number;
  duration_multiplier: number;
}

// ============================================================================
// Main function
// ============================================================================

/**
 * Apply intensity and duration multipliers to a template.
 *
 * - Duration: scales each segment's duration_minutes (rounded to nearest minute).
 * - Intensity: stored as metadata; target_intensity is scaled proportionally.
 * - target_km: scaled by duration_multiplier (rough distance proxy).
 * - rpe_target: scaled by intensity_multiplier (clamped 1-10).
 */
export function applyCalibratedTemplate(
  template: WorkoutTemplate,
  intensityMultiplier: number,
  durationMultiplier: number,
): CalibratedWorkout {
  const segments: CalibratedSegment[] = template.segments.map((seg) => ({
    type: seg.type,
    duration_minutes: Math.max(1, Math.round(seg.duration_minutes * durationMultiplier)),
    description: seg.description,
    target_intensity: seg.target_intensity != null
      ? Math.round(seg.target_intensity * intensityMultiplier)
      : null,
    sets: seg.sets,
  }));

  const totalDuration = segments.reduce((sum, s) => sum + s.duration_minutes, 0);
  const adjustedKm = template.target_km != null
    ? Math.round(template.target_km * durationMultiplier * 10) / 10
    : null;
  const adjustedRpe = Math.max(1, Math.min(10, Math.round(template.rpe_target * intensityMultiplier)));

  return {
    template_ref: template.template_ref,
    label: template.label,
    type: template.type,
    total_duration_minutes: totalDuration,
    segments,
    target_km: adjustedKm,
    description: template.description,
    rpe_target: adjustedRpe,
    intensity_multiplier: intensityMultiplier,
    duration_multiplier: durationMultiplier,
  };
}
