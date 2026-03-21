/**
 * Workout template module — static library + resolution + calibration.
 */

export { TEMPLATES, type WorkoutTemplate, type WorkoutSegment, type WorkoutSet } from "./workoutTemplates.js";
export { resolveTemplate } from "./resolveTemplate.js";
export { applyCalibratedTemplate, type CalibratedWorkout, type CalibratedSegment } from "./applyCalibratedTemplate.js";
