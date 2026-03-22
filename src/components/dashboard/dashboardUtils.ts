import type { CautionLevel, ReasonCode } from '@/lib/core/contracts';

/** Get caution level color classes */
export function getCautionStyles(level: CautionLevel): { bg: string; text: string; border: string } {
  switch (level) {
    case "high":
      return { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30" };
    case "moderate":
      return { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30" };
    case "low":
      return { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/30" };
    default:
      return { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/30" };
  }
}

/** Human-readable labels for reason codes */
const REASON_CODE_LABELS: Record<ReasonCode, string> = {
  SCHEDULED_WORKOUT_EXISTS: "Scheduled",
  RECOVERY_OPTIMAL: "Recovery optimal",
  FATIGUE_ELEVATED: "Fatigue elevated",
  FATIGUE_HIGH: "High fatigue",
  SLEEP_POOR: "Poor sleep",
  HRV_LOW: "Low HRV",
  HRV_DECLINING: "HRV declining",
  TRAINING_LOAD_HIGH: "High training load",
  TRAINING_LOAD_LOW: "Low training load",
  REST_DAY_DUE: "Rest day due",
  STREAK_RISK: "Training streak",
  ADAPTATION_PHASE: "Adapting",
  INSUFFICIENT_DATA: "Limited data",
  COLD_START: "New user",
  FORM_POSITIVE: "Fresh & adapted",
  FORM_NEGATIVE: "Overreaching",
  LLM_UNAVAILABLE: "AI unavailable",
  USER_PREFERENCE: "Your preference",
  ANOMALY_HRV_DISSOCIATION: "HRV dissociation",
  ANOMALY_OVERTRAINING_RISK: "Overtraining risk",
  ANOMALY_LOW_CONFIDENCE: "Low confidence",
  RHR_ELEVATED: "Elevated resting HR",
};

/** Format reason code for display using label map */
export function formatReasonCode(code: ReasonCode): string {
  return REASON_CODE_LABELS[code];
}

/** Fix common UTF-8 mojibake in rationale text */
export function sanitizeRationale(text: string): string {
  return text
    .replace(/\u00e2\u20ac\u201c/g, "\u2013")
    .replace(/\u00e2\u20ac\u201d/g, "\u2014")
    .replace(/\u00e2\u20ac\u0093/g, "\u2013")
    .replace(/\u00e2\u20ac\u0094/g, "\u2014");
}
