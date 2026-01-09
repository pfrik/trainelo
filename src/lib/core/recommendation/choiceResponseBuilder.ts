/**
 * Pure response builder for choice endpoint.
 * No IO, no Supabase, deterministic, unit-testable.
 */

import { SchemaVersion, type ChoiceResponse } from "../contracts";

/** Input for building a choice response */
export interface ChoiceResponseInput {
  /** ISO timestamp for recorded_at */
  recorded_at: string;
}

/**
 * Build a ChoiceResponse indicating the choice was recorded.
 * Pure function: no IO, fully deterministic given inputs.
 */
export function buildChoiceResponse(input: ChoiceResponseInput): ChoiceResponse {
  return {
    schema_version: SchemaVersion,
    recorded: true,
    recorded_at: input.recorded_at,
  };
}
