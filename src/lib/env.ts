/**
 * Environment variable validation (Vite-safe).
 * All feature flags default to false for safety.
 */

import { z } from "zod";

/** Parse string "true"/"false" to boolean, default false */
const booleanFlag = z
  .string()
  .optional()
  .transform((val) => val === "true");

/** Environment schema */
const envSchema = z.object({
  /** Enable LLM-based recommendation selection */
  VITE_ENABLE_LLM: booleanFlag,
  /** Enable auto-apply of calibration adjustments */
  VITE_ENABLE_CALIBRATION_AUTO_APPLY: booleanFlag,
  /** Enable evidence panel in UI */
  VITE_ENABLE_EVIDENCE_PANEL: booleanFlag,
});

/** Validated environment configuration */
export type EnvConfig = z.infer<typeof envSchema>;

/** Parse and validate environment variables */
function parseEnv(): EnvConfig {
  return envSchema.parse({
    VITE_ENABLE_LLM: import.meta.env.VITE_ENABLE_LLM,
    VITE_ENABLE_CALIBRATION_AUTO_APPLY:
      import.meta.env.VITE_ENABLE_CALIBRATION_AUTO_APPLY,
    VITE_ENABLE_EVIDENCE_PANEL: import.meta.env.VITE_ENABLE_EVIDENCE_PANEL,
  });
}

/** Singleton env config */
export const env = parseEnv();
