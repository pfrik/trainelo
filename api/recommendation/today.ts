/**
 * POST /api/recommendation/today
 * Vercel Serverless Function: Returns today's recommendation.
 * Deterministic stub - always returns candidates regardless of ENABLE_LLM.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildDeterministicTodayResponse } from "../../src/lib/core/recommendation";

export default function handler(req: VercelRequest, res: VercelResponse): void {
  // Only allow POST
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // For now, use a stub user_id (will be extracted from auth later)
  const user_id = "stub-user-id";

  // Get current date in YYYY-MM-DD format
  const now = new Date();
  const date = now.toISOString().split("T")[0];
  const generated_at = now.toISOString();

  const response = buildDeterministicTodayResponse({
    user_id,
    date,
    generated_at,
  });

  res.status(200).json(response);
}
