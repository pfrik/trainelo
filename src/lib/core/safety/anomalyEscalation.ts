/**
 * Temporal anomaly escalation.
 * Takes today's stateless anomaly result + recent history and applies
 * multi-day pattern rules: streak escalation, auto-resolve, cooldown.
 *
 * Pure function — no IO.
 */

import type { CautionLevel, Restriction, ReasonCode } from "../contracts/index.js";
import type { AnomalyResult } from "./anomaly.js";

// ============================================================================
// Types
// ============================================================================

export interface AnomalyLogEntry {
  date: string;
  reason_codes: string[];
  caution_level: string;
  restrictions: string[];
  resolved: boolean;
}

export interface EscalatedAnomalyResult extends AnomalyResult {
  escalation_note: string | null;
  streak_days: number;
  resolved_today: string[];
}

// ============================================================================
// Constants
// ============================================================================

/** Number of consecutive days before HRV_DISSOCIATION escalates to high. */
const HRV_DISSOCIATION_ESCALATION_DAYS = 3;

/** Number of consecutive days before OVERTRAINING_RISK gets stronger messaging. */
const OVERTRAINING_ESCALATION_DAYS = 2;

/** Number of consecutive days before LOW_CONFIDENCE escalates to moderate. */
const LOW_CONFIDENCE_ESCALATION_DAYS = 5;

const CAUTION_ORDER: CautionLevel[] = ["none", "low", "moderate", "high"];

function maxCaution(a: CautionLevel, b: CautionLevel): CautionLevel {
  return CAUTION_ORDER.indexOf(a) >= CAUTION_ORDER.indexOf(b) ? a : b;
}

// ============================================================================
// Core
// ============================================================================

/**
 * Escalate today's anomaly result based on recent history.
 *
 * @param todayResult - Today's raw anomaly detection result
 * @param history - Recent anomaly log entries, ordered by date DESC (most recent first).
 *                  Should NOT include today's entry (it hasn't been committed yet when
 *                  escalation runs during the live endpoint; in the cron it's already persisted
 *                  but this function ignores today by comparing dates).
 */
export function escalateAnomalies(
  todayResult: AnomalyResult,
  history: AnomalyLogEntry[],
): EscalatedAnomalyResult {
  // Start from today's raw result
  let cautionLevel = todayResult.caution_level;
  const reasonCodes = [...todayResult.reason_codes];
  const restrictions = [...todayResult.restrictions];
  let escalationNote: string | null = null;
  let streakDays = 0;
  const resolvedToday: string[] = [];

  // Count consecutive days for each active anomaly
  for (const code of todayResult.reason_codes) {
    const streak = countConsecutiveStreak(code, history);
    streakDays = Math.max(streakDays, streak + 1); // +1 for today

    // Escalation: HRV_DISSOCIATION 3+ days → high + suggest_rest
    if (
      code === "ANOMALY_HRV_DISSOCIATION" &&
      streak + 1 >= HRV_DISSOCIATION_ESCALATION_DAYS
    ) {
      cautionLevel = maxCaution(cautionLevel, "high");
      if (!restrictions.includes("suggest_rest")) {
        restrictions.push("suggest_rest");
      }
      escalationNote = `HRV suppression detected ${streak + 1} days in a row — rest strongly recommended.`;
    }

    // Escalation: OVERTRAINING_RISK 2+ days → stronger messaging
    if (
      code === "ANOMALY_OVERTRAINING_RISK" &&
      streak + 1 >= OVERTRAINING_ESCALATION_DAYS
    ) {
      escalationNote = `Overtraining risk signals persisting for ${streak + 1} consecutive days — consider extended recovery.`;
    }

    // Escalation: LOW_CONFIDENCE 5+ days → moderate + cap_intensity
    if (
      code === "ANOMALY_LOW_CONFIDENCE" &&
      streak + 1 >= LOW_CONFIDENCE_ESCALATION_DAYS
    ) {
      cautionLevel = maxCaution(cautionLevel, "moderate");
      if (!restrictions.includes("cap_intensity")) {
        restrictions.push("cap_intensity");
      }
      escalationNote = `Data quality has been unreliable for ${streak + 1} days — intensity capped as a precaution.`;
    }
  }

  // Auto-resolve: check if yesterday had anomalies that today doesn't
  if (history.length > 0) {
    const yesterday = history[0];
    if (yesterday && !yesterday.resolved) {
      for (const prevCode of yesterday.reason_codes) {
        if (!todayResult.reason_codes.includes(prevCode as ReasonCode)) {
          resolvedToday.push(prevCode);
        }
      }
    }
  }

  return {
    caution_level: cautionLevel,
    reason_codes: reasonCodes,
    restrictions: restrictions as Restriction[],
    question_key: todayResult.question_key,
    escalation_note: escalationNote,
    streak_days: streakDays,
    resolved_today: resolvedToday,
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Count how many consecutive prior days (from history) contain the given reason code.
 * History is ordered by date DESC. Stops at the first day that doesn't contain the code.
 */
function countConsecutiveStreak(
  reasonCode: string,
  history: AnomalyLogEntry[],
): number {
  let count = 0;
  for (const entry of history) {
    if (entry.reason_codes.includes(reasonCode)) {
      count++;
    } else {
      break;
    }
  }
  return count;
}
