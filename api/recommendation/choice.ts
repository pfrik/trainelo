/**
 * POST /api/recommendation/choice
 * Vercel Serverless Function: Records user's choice on a recommendation.
 * Stub implementation - logs to console, returns success response.
 * Supabase persistence will be added later.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ChoiceRequestSchema } from "../../src/lib/core/contracts/index.js";
import { buildChoiceResponse } from "../../src/lib/core/recommendation/choiceResponseBuilder.js";

export default function handler(req: VercelRequest, res: VercelResponse): void {
  // Only allow POST
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Parse body robustly: wrap in try-catch as Vercel throws on invalid JSON access
  let body: unknown;
  try {
    const rawBody = req.body;
    if (typeof rawBody === "string") {
      body = JSON.parse(rawBody);
    } else {
      body = rawBody;
    }
  } catch {
    console.log("[choice] JSON parse error");
    res.status(400).json({ error: "INVALID_REQUEST", details: { formErrors: ["Invalid JSON"], fieldErrors: {} } });
    return;
  }

  // Validate request body
  const parseResult = ChoiceRequestSchema.safeParse(body);
  if (!parseResult.success) {
    console.log("[choice] Validation failed:", parseResult.error.flatten());
    res.status(400).json({
      error: "INVALID_REQUEST",
      details: parseResult.error.flatten(),
    });
    return;
  }

  const choiceRequest = parseResult.data;

  // Log the choice (stub implementation - Supabase will be added later)
  console.log("[choice] Received choice:", {
    recommendation_id: choiceRequest.recommendation_id,
    chosen_candidate_id: choiceRequest.chosen_candidate_id,
    action: choiceRequest.action,
    note: choiceRequest.note ?? null,
    timestamp: new Date().toISOString(),
  });

  const recorded_at = new Date().toISOString();
  const response = buildChoiceResponse({ recorded_at });

  res.status(200).json(response);
}
