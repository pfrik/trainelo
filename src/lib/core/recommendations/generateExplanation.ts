/**
 * LLM-powered coaching explanation generator.
 * Takes the evidence summary + top candidate and returns a 2-3 sentence
 * natural-language explanation of why today's workout makes sense.
 *
 * Uses Claude Haiku for speed and cost efficiency.
 * Non-fatal: returns null on any error, letting the deterministic rationale
 * serve as fallback.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { EvidenceSummary, RecommendationCandidate } from "../contracts/recommendation.js";

// ============================================================================
// Client (lazy singleton)
// ============================================================================

let _client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (_client) return _client;
  const key = process.env.ANTHROPIC_API_KEY?.replace(/^["']|["']$/g, "").trim();
  if (!key) return null;
  _client = new Anthropic({ apiKey: key });
  return _client;
}

// ============================================================================
// Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are a calm, precise training coach for Trainelo, an AI-powered training app. Your job is to explain why today's workout recommendation makes sense for this athlete.

Rules:
- Write exactly 2-3 sentences. No more.
- Reference specific data points: fatigue score, sleep quality, HRV trend, training phase, form score, check-in mood — whatever is relevant.
- Be conversational and reassuring, like a coach speaking to their athlete in the morning.
- Never use emojis.
- Never start with "Based on your data" or "Looking at your metrics" — just speak naturally.
- If the recommendation is rest, explain why rest is the smart choice today.
- If there's a training plan active, mention the phase and how today fits the bigger picture.
- Use plain language. Say "your body is recovering well" not "your physiological markers indicate adequate recovery."`;

function buildUserPrompt(
  evidence: EvidenceSummary,
  candidate: RecommendationCandidate,
): string {
  const parts: string[] = [];

  // Recommendation
  parts.push(`TODAY'S RECOMMENDATION: ${candidate.label}`);
  parts.push(`Decision: ${candidate.id}`);
  if (candidate.reason_codes?.length) {
    parts.push(`Reason codes: ${candidate.reason_codes.join(", ")}`);
  }

  // Core metrics
  parts.push("");
  parts.push("ATHLETE STATE:");
  if (evidence.fatigue_score != null) parts.push(`Fatigue: ${evidence.fatigue_score}/100`);
  if (evidence.fitness_score != null) parts.push(`Fitness: ${evidence.fitness_score}/100`);
  if (evidence.sleep_quality != null) parts.push(`Sleep quality: ${evidence.sleep_quality}/100`);
  if (evidence.hrv_trend) parts.push(`HRV trend: ${evidence.hrv_trend}`);
  if (evidence.days_since_rest != null) parts.push(`Days since rest: ${evidence.days_since_rest}`);
  if (evidence.confidence != null) parts.push(`Data confidence: ${Math.round(evidence.confidence * 100)}%`);

  // EWMA
  if (evidence.ewma_form_score != null) {
    const form = evidence.ewma_form_score;
    const zone = form > 15 ? "transition" : form > 5 ? "fresh" : form > -10 ? "grey zone" : form > -25 ? "optimal training" : "high risk";
    parts.push(`Form: ${form > 0 ? "+" : ""}${Math.round(form)} (${zone})`);
  }
  if (evidence.ewma_fitness_score != null) parts.push(`EWMA Fitness: ${Math.round(evidence.ewma_fitness_score)}`);
  if (evidence.ewma_fatigue_score != null) parts.push(`EWMA Fatigue: ${Math.round(evidence.ewma_fatigue_score)}`);

  // Check-in
  if (evidence.checkin_mood) {
    parts.push("");
    parts.push("MORNING CHECK-IN:");
    parts.push(`Mood: ${evidence.checkin_mood}`);
    if (evidence.checkin_rpe != null) parts.push(`RPE: ${evidence.checkin_rpe}/10`);
    if (evidence.checkin_soreness != null) parts.push(`Soreness: ${evidence.checkin_soreness}/10`);
    if (evidence.checkin_pain_flag) parts.push("Pain flagged");
    if (evidence.checkin_illness_flag) parts.push("Illness flagged");
  }

  // Calibration
  if (evidence.calibration_headline) {
    parts.push("");
    parts.push(`CALIBRATION: ${evidence.calibration_headline}`);
    if (evidence.calibration_intensity_multiplier != null) {
      parts.push(`Intensity adjusted to ${Math.round(evidence.calibration_intensity_multiplier * 100)}%`);
    }
    if (evidence.calibration_duration_multiplier != null) {
      parts.push(`Duration adjusted to ${Math.round(evidence.calibration_duration_multiplier * 100)}%`);
    }
  }

  // Goal context
  if (evidence.goal_title) {
    parts.push("");
    parts.push("TRAINING PLAN:");
    parts.push(`Goal: ${evidence.goal_title}`);
    if (evidence.training_phase) parts.push(`Phase: ${evidence.training_phase}`);
    if (evidence.plan_week_number) parts.push(`Week: ${evidence.plan_week_number}`);
    if (evidence.days_until_race != null) parts.push(`Days until race: ${evidence.days_until_race}`);
  }

  // Anomaly
  if (evidence.anomaly_caution_level && evidence.anomaly_caution_level !== "none") {
    parts.push("");
    parts.push(`ANOMALY: Caution level ${evidence.anomaly_caution_level}`);
    if (evidence.anomaly_restrictions?.length) {
      parts.push(`Restrictions: ${evidence.anomaly_restrictions.join(", ")}`);
    }
  }

  return parts.join("\n");
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Generate a coaching explanation for today's recommendation.
 * Returns null if LLM is unavailable, errors, or times out.
 */
export async function generateExplanation(
  evidence: EvidenceSummary,
  topCandidate: RecommendationCandidate,
): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  const userPrompt = buildUserPrompt(evidence, topCandidate);

  try {
    const response = await Promise.race([
      client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 150,
        temperature: 0.3,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);

    if (!response) return null; // timeout

    const text = response.content?.[0];
    if (text?.type === "text" && text.text.trim()) {
      return text.text.trim();
    }

    return null;
  } catch {
    return null;
  }
}
