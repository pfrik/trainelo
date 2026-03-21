/**
 * Passive calibration orchestrator.
 * Fetches data, runs detection, checks safeguards, applies results.
 */

import type { Logger } from "../observability/log.js";
import type {
  ThresholdType,
  CalibrationRunResult,
  ThresholdDecision,
  SkipReason,
  DetectionResult,
} from "./types.js";
import { CONFIDENCE_GATES, UNDO_DEADLINE_DAYS } from "./types.js";
import {
  detectHRMax,
  detectRestingHR,
  detectHRVBaseline,
  hasSignificantChange,
} from "./detectThresholds.js";
import {
  getRecentWorkoutHR,
  getDailyMetrics,
  getActiveThreshold,
  insertUserThreshold,
  closeUserThreshold,
  getActiveCooldown,
  type UserThresholdRow,
} from "../../db/queries.js";
import { getHrvHistory } from "../../db/queries.js";
import { insertCalibrationEvent } from "../../db/queries.js";

// ============================================================================
// Threshold Configuration
// ============================================================================

const THRESHOLD_CONFIGS: Array<{
  type: ThresholdType;
  unit: string;
}> = [
  { type: "hr_max", unit: "bpm" },
  { type: "resting_hr", unit: "bpm" },
  { type: "hrv_baseline", unit: "ms" },
];

// ============================================================================
// Data Fetching + Detection per Type
// ============================================================================

async function fetchAndDetect(
  thresholdType: ThresholdType,
  userId: string,
  targetDate: string,
): Promise<DetectionResult | null> {
  switch (thresholdType) {
    case "hr_max": {
      const { data, error } = await getRecentWorkoutHR(userId, targetDate, 90);
      if (error || data.length === 0) return null;
      const samples = data.map((r) => ({
        date: r.started_at.slice(0, 10),
        max_heart_rate: r.max_heart_rate,
        duration_seconds: r.duration_seconds,
      }));
      return detectHRMax(samples, targetDate);
    }
    case "resting_hr": {
      const metrics = await getDailyMetrics(userId, 14);
      const samples = metrics
        .filter((m) => m.resting_heart_rate != null)
        .map((m) => ({
          date: m.date,
          resting_heart_rate: m.resting_heart_rate!,
        }));
      return detectRestingHR(samples, targetDate);
    }
    case "hrv_baseline": {
      const { data, error } = await getHrvHistory(userId, targetDate, 14);
      if (error) return null;
      const samples = data.map((r) => ({
        date: r.date,
        hrv_rmssd: r.hrv_rmssd,
      }));
      return detectHRVBaseline(samples, targetDate);
    }
  }
}

// ============================================================================
// Lock Check (respects lock_expires_at)
// ============================================================================

function isEffectivelyLocked(threshold: UserThresholdRow, now: string): boolean {
  if (!threshold.is_locked) return false;
  // If lock has an expiration and it's passed, treat as unlocked
  if (threshold.lock_expires_at && threshold.lock_expires_at <= now) return false;
  return true;
}

// ============================================================================
// Single Threshold Orchestration
// ============================================================================

async function processThreshold(
  thresholdType: ThresholdType,
  unit: string,
  userId: string,
  targetDate: string,
  now: string,
  log: Logger,
): Promise<ThresholdDecision> {
  const skip = (reason: SkipReason): ThresholdDecision => ({
    thresholdType,
    action: "skipped",
    skipReason: reason,
  });

  // 1. Fetch raw data + run pure detection
  const detection = await fetchAndDetect(thresholdType, userId, targetDate);
  if (!detection) {
    log.info("calibration skip", { threshold: thresholdType, reason: "insufficient_data", user_id: userId });
    return skip("insufficient_data");
  }

  // 2. Check confidence gate
  if (detection.confidence.score < CONFIDENCE_GATES[thresholdType]) {
    log.info("calibration skip", {
      threshold: thresholdType,
      reason: "low_confidence",
      score: detection.confidence.score,
      gate: CONFIDENCE_GATES[thresholdType],
      user_id: userId,
    });
    return skip("low_confidence");
  }

  // 3. Fetch existing active threshold
  const { data: existing, error: thresholdError } = await getActiveThreshold(userId, thresholdType);
  if (thresholdError) {
    log.warn("calibration threshold fetch error", { threshold: thresholdType, error: thresholdError, user_id: userId });
    return skip("insufficient_data");
  }

  // 4. Check lock
  if (existing && isEffectivelyLocked(existing, now)) {
    log.info("calibration skip", { threshold: thresholdType, reason: "locked", user_id: userId });
    return skip("locked");
  }

  // 5. Check cooldown
  const { data: cooldown, error: cooldownError } = await getActiveCooldown(userId, thresholdType, now);
  if (cooldownError) {
    log.warn("calibration cooldown fetch error", { threshold: thresholdType, error: cooldownError, user_id: userId });
  }
  if (cooldown) {
    log.info("calibration skip", { threshold: thresholdType, reason: "cooldown", cooldown_ends_at: cooldown.cooldown_ends_at, user_id: userId });
    return skip("cooldown");
  }

  // 6. Check significant change
  const existingValue = existing?.value_numeric ?? null;
  if (!hasSignificantChange(thresholdType, detection.value, existingValue)) {
    log.info("calibration skip", {
      threshold: thresholdType,
      reason: "no_change",
      detected: detection.value,
      existing: existingValue,
      user_id: userId,
    });
    return skip("no_change");
  }

  // 7. Apply
  const undoDeadline = new Date(now);
  undoDeadline.setUTCDate(undoDeadline.getUTCDate() + UNDO_DEADLINE_DAYS);
  const undoDeadlineStr = undoDeadline.toISOString();

  try {
    // Close existing threshold if present
    if (existing) {
      const closeResult = await closeUserThreshold(existing.id, targetDate);
      if (closeResult.error) {
        log.warn("calibration close error", { threshold: thresholdType, error: closeResult.error, user_id: userId });
        return skip("insufficient_data");
      }
    }

    // Insert new threshold
    const insertResult = await insertUserThreshold({
      user_id: userId,
      threshold_type: thresholdType,
      value_numeric: detection.value,
      value_unit: unit,
      effective_from: targetDate,
      source: "auto_calibration",
      confidence_level: detection.confidence.level,
      calibration_method: detection.method,
      last_calibrated_at: now,
    });

    if (insertResult.error || !insertResult.data) {
      log.warn("calibration insert error", { threshold: thresholdType, error: insertResult.error, user_id: userId });
      return skip("insufficient_data");
    }

    // Insert calibration event for audit trail
    const eventType = existing ? "auto_calibration" : "threshold_created";
    const isUndoable = existing != null; // Only existing → replaced is undoable

    await insertCalibrationEvent({
      user_id: userId,
      event_type: eventType,
      threshold_id: insertResult.data.id,
      threshold_type: thresholdType,
      previous_value: existing
        ? { value_numeric: existing.value_numeric }
        : null,
      new_value: { value_numeric: detection.value },
      change_reason: `Auto-detected from ${detection.dataPoints} data points (${detection.method})`,
      change_trigger: "passive_calibration",
      is_undoable: isUndoable,
      undo_deadline: isUndoable ? undoDeadlineStr : null,
      cooldown_ends_at: undoDeadlineStr,
      cooldown_reason: "auto_calibration_cooldown",
      actor_type: "system",
      actor_id: "passive_calibration_v1",
    });

    log.info("calibration applied", {
      threshold: thresholdType,
      value: detection.value,
      previous: existingValue,
      confidence: detection.confidence.score,
      data_points: detection.dataPoints,
      user_id: userId,
    });

    return {
      thresholdType,
      action: "applied",
      detectedValue: detection.value,
      previousValue: existingValue,
      confidence: detection.confidence,
    };
  } catch (err) {
    log.warn("calibration apply error", {
      threshold: thresholdType,
      error: err instanceof Error ? err.message : String(err),
      user_id: userId,
    });
    return skip("insufficient_data");
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Run passive calibration for a single user.
 * Processes all 3 threshold types independently.
 * Non-fatal: errors per-threshold are logged and skipped.
 */
export async function runPassiveCalibration(
  userId: string,
  targetDate: string,
  log: Logger,
): Promise<CalibrationRunResult> {
  const now = new Date().toISOString();
  const decisions: ThresholdDecision[] = [];

  for (const config of THRESHOLD_CONFIGS) {
    try {
      const decision = await processThreshold(
        config.type,
        config.unit,
        userId,
        targetDate,
        now,
        log,
      );
      decisions.push(decision);
    } catch (err) {
      log.warn("calibration threshold error", {
        threshold: config.type,
        error: err instanceof Error ? err.message : String(err),
        user_id: userId,
      });
      decisions.push({
        thresholdType: config.type,
        action: "skipped",
        skipReason: "insufficient_data",
      });
    }
  }

  return {
    userId,
    targetDate,
    applied: decisions.filter((d) => d.action === "applied").length,
    skipped: decisions.filter((d) => d.action === "skipped").length,
    decisions,
  };
}
