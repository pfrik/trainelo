/**
 * Tests for POST /api/recommendation/today handler.
 *
 * Covers: check-in evidence passthrough, calibration evidence fields,
 * hard-stop caution elevation, and missing-checkin null safety.
 * Mocks DB queries and Supabase client to isolate handler logic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB queries before importing handler
vi.mock("../../src/lib/db/queries.js", () => ({
  getDailyUserState: vi.fn(),
  getTrainingLoad7Days: vi.fn(),
  getDailyCheckin: vi.fn(),
  getHrvHistory: vi.fn().mockResolvedValue({ data: [], error: null }),
  getUserDataDays: vi.fn().mockResolvedValue({ data: 0, error: null }),
  getPriorChronicLoad: vi.fn().mockResolvedValue({ data: null, error: null }),
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

/** Full v2 check-in row with all fields. */
function makeCheckinRow(overrides: Record<string, unknown> = {}) {
  return {
    mood: "okay",
    rpe: null,
    soreness: null,
    pain_flag: false,
    illness_flag: false,
    reason_bucket: null,
    pain_severity: null,
    pain_locations: null,
    time_constraint_minutes: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests — check-in evidence passthrough
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
      data: makeCheckinRow({
        mood: "tired",
        rpe: 8,
        soreness: 6,
        pain_flag: true,
        illness_flag: false,
      }),
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

    // Impact deltas: tired(-8,+8) + rpe>=8(+8 fatigue) + pain(-15,+12)
    expect(evidence.checkin_readiness_delta).toBe(-23);
    expect(evidence.checkin_fatigue_delta).toBe(28);
    expect(evidence.checkin_impact_note).toBe(
      "Check-in impact: fatigue +28, readiness -23.",
    );
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

    // Impact fields should be null when no check-in
    expect(evidence.checkin_readiness_delta).toBeNull();
    expect(evidence.checkin_fatigue_delta).toBeNull();
    expect(evidence.checkin_impact_note).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests — calibration evidence integration
// ---------------------------------------------------------------------------

describe("POST /api/recommendation/today — calibration evidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TRAINELO_USER_ID = "test-user";
  });

  it("populates calibration evidence fields when check-in + wearable data present", async () => {
    vi.mocked(getDailyUserState).mockResolvedValueOnce({
      data: STATE_ROW,
      error: null,
    });
    vi.mocked(getTrainingLoad7Days).mockResolvedValueOnce({
      data: [],
      error: null,
    });
    vi.mocked(getDailyCheckin).mockResolvedValueOnce({
      data: makeCheckinRow({ mood: "good" }),
      error: null,
    });

    const req = makeReq();
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    const evidence = res._body.evidence;

    // Calibration fields should be populated (not null)
    expect(evidence.calibration_level).toBeDefined();
    expect(evidence.calibration_level).not.toBeNull();
    expect(evidence.calibration_intensity_multiplier).toBeTypeOf("number");
    expect(evidence.calibration_duration_multiplier).toBeTypeOf("number");
    expect(Array.isArray(evidence.calibration_applied_rules)).toBe(true);
    expect(Array.isArray(evidence.calibration_warnings)).toBe(true);
    expect(evidence.calibration_headline).toBeTypeOf("string");
    expect(evidence.calibration_rationale).toBeTypeOf("string");

    // "good" mood with healthy STATE_ROW => green level, 1.0 multipliers
    expect(evidence.calibration_level).toBe("green");
    expect(evidence.calibration_intensity_multiplier).toBe(1.0);
    expect(evidence.calibration_duration_multiplier).toBe(1.0);
  });

  it("hard-stop (illness) sets red calibration and elevates top candidate caution", async () => {
    vi.mocked(getDailyUserState).mockResolvedValueOnce({
      data: STATE_ROW,
      error: null,
    });
    vi.mocked(getTrainingLoad7Days).mockResolvedValueOnce({
      data: [],
      error: null,
    });
    vi.mocked(getDailyCheckin).mockResolvedValueOnce({
      data: makeCheckinRow({
        mood: "drained",
        illness_flag: true,
        reason_bucket: "sick",
      }),
      error: null,
    });

    const req = makeReq();
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    const evidence = res._body.evidence;
    const topCandidate = res._body.candidates[0];

    // Hard-stop → red calibration
    expect(evidence.calibration_level).toBe("red");
    expect(evidence.calibration_intensity_multiplier).toBeLessThanOrEqual(0.70);
    expect(evidence.calibration_warnings!.length).toBeGreaterThan(0);

    // Top candidate caution should be elevated to high
    expect(topCandidate.caution_level).toBe("high");
  });

  it("returns null calibration fields when no check-in exists (deterministic fallback)", async () => {
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

    // No check-in → calibrator still runs with null checkin (wearable-only fallback)
    // With healthy STATE_ROW the derived wearable is green → level should be green
    expect(evidence.calibration_level).toBe("green");
    expect(evidence.calibration_intensity_multiplier).toBe(1.0);
    expect(evidence.calibration_applied_rules).toContain("NO_CHECKIN");
  });
});
