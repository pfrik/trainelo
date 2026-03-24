/**
 * Resolve a template_ref to a full WorkoutTemplate.
 * Returns null for unknown refs or null input (rest/skip candidates).
 *
 * Static templates (TEMPLATE_MAP) take priority. If no static match,
 * falls back to dynamic generation via buildTemplateFromRef() which
 * supports the {sport}-{type}-{duration}min naming convention used
 * by goal-based training plans.
 */

import { TEMPLATES, type WorkoutTemplate } from "./workoutTemplates.js";
import { buildTemplateFromRef } from "../training/workoutFactory.js";

const TEMPLATE_MAP = new Map<string, WorkoutTemplate>(
  TEMPLATES.map((t) => [t.template_ref, t]),
);

export function resolveTemplate(templateRef: string | null): WorkoutTemplate | null {
  if (!templateRef) return null;
  return TEMPLATE_MAP.get(templateRef) ?? buildTemplateFromRef(templateRef);
}
