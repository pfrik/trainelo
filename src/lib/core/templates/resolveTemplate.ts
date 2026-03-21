/**
 * Resolve a template_ref to a full WorkoutTemplate.
 * Returns null for unknown refs or null input (rest/skip candidates).
 */

import { TEMPLATES, type WorkoutTemplate } from "./workoutTemplates.js";

const TEMPLATE_MAP = new Map<string, WorkoutTemplate>(
  TEMPLATES.map((t) => [t.template_ref, t]),
);

export function resolveTemplate(templateRef: string | null): WorkoutTemplate | null {
  if (!templateRef) return null;
  return TEMPLATE_MAP.get(templateRef) ?? null;
}
