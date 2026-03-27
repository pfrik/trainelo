/**
 * Plan adaptation logic — adjusts upcoming training based on actual execution.
 * Pure function: no IO, fully testable.
 *
 * Follows the "least intervention" principle:
 * - Never adds volume after missed workouts
 * - Only reduces when strong evidence supports it
 * - Never auto-increases volume on overperformance
 */

import type { Phase } from "./types.js";

// ============================================================================
// Types
// ============================================================================

export interface AdaptationInput {
  /** Number of consecutive missed workout days (0 = no misses) */
  consecutiveMissedDays: number;
  /** Plan compliance over last 2 weeks (0-1) */
  recentCompliancePct: number;
  /** Days until race */
  daysUntilRace: number;
  /** Current training phase */
  currentPhase: Phase;
  /** Whether the user flagged illness in their check-in */
  illnessFlag: boolean;
  /** Whether the user flagged injury/pain in their check-in */
  painFlag: boolean;
  /** Average surplus ratio over last 7 days (actual_tss / planned_tss). */
  recentLoadSurplusAvg?: number | null;
  /** Total transferred cross-sport TSS over last 7 days. */
  crossSportTransferredTss7d?: number | null;
}

export interface AdaptationResult {
  /** Volume adjustment multiplier for the next week (0.4-1.0) */
  volumeMultiplier: number;
  /** Whether to insert a recovery bridge week */
  insertRecoveryWeek: boolean;
  /** Whether the plan should be fully regenerated */
  replanRecommended: boolean;
  /** Human-readable explanation */
  reason: string;
  /** Risk level for the user */
  riskLevel: "low" | "medium" | "high";
}

// ============================================================================
// Main function
// ============================================================================

export function adaptPlan(input: AdaptationInput): AdaptationResult {
  const {
    consecutiveMissedDays,
    recentCompliancePct,
    daysUntilRace,
    currentPhase,
    illnessFlag,
    painFlag,
  } = input;

  // Near-race: never add volume, just absorb misses
  if (daysUntilRace <= 28 || currentPhase === "taper") {
    if (consecutiveMissedDays >= 4) {
      return {
        volumeMultiplier: 0.5,
        insertRecoveryWeek: false,
        replanRecommended: false,
        reason: "Multiple missed days close to race — reducing volume to protect taper.",
        riskLevel: "medium",
      };
    }
    return {
      volumeMultiplier: 1.0,
      insertRecoveryWeek: false,
      replanRecommended: false,
      reason: "Close to race — absorbing missed session, no plan changes.",
      riskLevel: "low",
    };
  }

  // Illness or injury: conservative approach
  if (illnessFlag || painFlag) {
    if (consecutiveMissedDays >= 4) {
      return {
        volumeMultiplier: 0.4,
        insertRecoveryWeek: true,
        replanRecommended: true,
        reason: illnessFlag
          ? "Extended illness — inserting recovery week and recommending plan review."
          : "Injury concern — inserting recovery week and recommending plan review.",
        riskLevel: "high",
      };
    }
    return {
      volumeMultiplier: 0.7,
      insertRecoveryWeek: false,
      replanRecommended: false,
      reason: illnessFlag
        ? "Illness detected — reducing next week volume by 30%."
        : "Pain/injury detected — reducing next week volume by 30%.",
      riskLevel: "medium",
    };
  }

  // 4-7 consecutive missed days: recovery bridge
  if (consecutiveMissedDays >= 4) {
    return {
      volumeMultiplier: 0.4,
      insertRecoveryWeek: true,
      replanRecommended: consecutiveMissedDays >= 7,
      reason: `${consecutiveMissedDays} consecutive missed days — inserting recovery bridge week.`,
      riskLevel: "high",
    };
  }

  // 2-3 consecutive missed days: moderate reduction
  if (consecutiveMissedDays >= 2) {
    return {
      volumeMultiplier: 0.8,
      insertRecoveryWeek: false,
      replanRecommended: false,
      reason: `${consecutiveMissedDays} consecutive missed days — reducing next week volume by 20%.`,
      riskLevel: "medium",
    };
  }

  // Chronic underperformance: < 70% compliance over 2 weeks
  if (recentCompliancePct < 0.7) {
    return {
      volumeMultiplier: 0.85,
      insertRecoveryWeek: false,
      replanRecommended: recentCompliancePct < 0.5,
      reason: `Compliance at ${Math.round(recentCompliancePct * 100)}% — reducing peak volume target.`,
      riskLevel: recentCompliancePct < 0.5 ? "high" : "medium",
    };
  }

  // Cross-training load adjustment: reduce plan volume when significant
  // cross-sport load is adding systemic fatigue the plan doesn't account for.
  // Never auto-increase, per least-intervention principle.
  const surplusAvg = input.recentLoadSurplusAvg ?? null;
  const crossTss = input.crossSportTransferredTss7d ?? null;

  if (crossTss != null && crossTss > 200) {
    return {
      volumeMultiplier: 0.85,
      insertRecoveryWeek: false,
      replanRecommended: false,
      reason: "Significant cross-sport training load detected — reducing plan volume by 15%.",
      riskLevel: "medium",
    };
  }

  if (surplusAvg != null && surplusAvg > 1.3) {
    return {
      volumeMultiplier: 0.9,
      insertRecoveryWeek: false,
      replanRecommended: false,
      reason: "Consistently training above plan — reducing volume by 10% to prevent overload.",
      riskLevel: "low",
    };
  }

  // 1 missed day or normal compliance: no change
  return {
    volumeMultiplier: 1.0,
    insertRecoveryWeek: false,
    replanRecommended: false,
    reason: "Training on track — no adjustments needed.",
    riskLevel: "low",
  };
}
