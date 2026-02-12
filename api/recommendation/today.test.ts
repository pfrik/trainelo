/**
 * Tests for POST /api/recommendation/today handler.
 *
 * Focused on evidence check-in field passthrough.
 * Mocks DB queries and Supabase client to isolate handler logic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB queries before importing handler
vi.mock("../../src/lib/db/queries.js", () => ({
  getDailyUserState: vi.fn(),
  getTrainingLoad7Days: vi.fn(),
  getDailyCheckin: vi.fn(),
}));

// Mock @supabase/supabase-js to prevent real client creation
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({})),
}));

import handler from "./today";
import {
  getDailyUserState,
  getTrainingLoad7Days,
  getDailyCheckin,
} from "../../src/lib/db/queries.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    method: "POST",
    headers: {},
    body: {},
    ...overrides,
  } as any;
}

function makeRes() {
  const res: any = {
    _status: 0,
    _body: null,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(body: unknown) {
      res._body = body;
      return res;
    },
  };
  return res;
}

/** Minimal daily_user_state row so the pipeline reaches evidence building. */
const STATE_ROW = {
  user_id: "test-user",
  date: "2026-02-10",
  sleep_score: 80,
  sleep_seconds: 28800,
  avg_hrv_ms: 45,
  hrv_rmssd: 50,
  hrv_baseline: 50,
  recovery_score: 75,
  acute_load_7d: 200,
  chronic_load_28d: 180,
  days_since_rest: 1,
  last_hard_session_date: null,
  last_garmin_sync_at: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/recommendation/today — check-in evidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TRAINELO_USER_ID = "test-user";
  });

  it("includes check-in fields in evidence when check-in is present", async () => {
    vi.mocked(getDailyUserState).mockResolvedValueOnce({
      data: STATE_ROW,
      error: null,
    });
    vi.mocked(getTrainingLoad7Days).mockResolvedValueOnce({
      data: [],
      error: null,
    });
    vi.mocked(getDailyCheckin).mockResolvedValueOnce({
      data: {
        mood: "tired",
        rpe: 8,
        soreness: 6,
        pain_flag: true,
        illness_flag: false,
      },
      error: null,
    });

    const req = makeReq();
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    const evidence = res._body.evidence;
    expect(evidence.checkin_mood).toBe("tired");
    expect(evidence.checkin_rpe).toBe(8);
    expect(evidence.checkin_soreness).toBe(6);
    expect(evidence.checkin_pain_flag).toBe(true);
    expect(evidence.checkin_illness_flag).toBe(false);
  });

  it("returns null check-in fields when no check-in exists", async () => {
    vi.mocked(getDailyUserState).mockResolvedValueOnce({
      data: STATE_ROW,
      error: null,
    });
    vi.mocked(getTrainingLoad7Days).mockResolvedValueOnce({
      data: [],
      error: null,
    });
    vi.mocked(getDailyCheckin).mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const req = makeReq();
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    const evidence = res._body.evidence;
    expect(evidence.checkin_mood).toBeNull();
    expect(evidence.checkin_rpe).toBeNull();
    expect(evidence.checkin_soreness).toBeNull();
    expect(evidence.checkin_pain_flag).toBeNull();
    expect(evidence.checkin_illness_flag).toBeNull();
  });
});
