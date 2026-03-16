/**
 * Tests for POST /api/user-flags handler.
 *
 * Mocks VercelRequest/VercelResponse and the DB upsert function
 * to verify routing, validation, auth gating, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DB functions before importing the handler
vi.mock("../src/lib/db/queries.js", () => ({
  upsertDailyCheckin: vi.fn(),
  getDailyUserState: vi.fn().mockResolvedValue({ data: null, error: null }),
  getTrainingLoad7Days: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

// Mock @supabase/supabase-js to prevent real client creation
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({})),
}));

import handler from "./user-flags";
import { upsertDailyCheckin } from "../src/lib/db/queries.js";

// ---------------------------------------------------------------------------
// Helpers: minimal VercelRequest/VercelResponse fakes
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

const VALID_BODY = { mood: "good" };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/user-flags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TRAINELO_USER_ID;
  });

  it("returns 405 for non-POST methods", async () => {
    const req = makeReq({ method: "GET" });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(405);
    expect(res._body.error).toBe("Method not allowed");
  });

  it("returns 400 for invalid body (missing mood)", async () => {
    process.env.TRAINELO_USER_ID = "test-user-id";
    const req = makeReq({ body: { rpe: 5 } });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(400);
    expect(res._body.error).toBe("INVALID_REQUEST");
  });

  it("returns 400 for invalid mood value", async () => {
    process.env.TRAINELO_USER_ID = "test-user-id";
    const req = makeReq({ body: { mood: "amazing" } });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(400);
    expect(res._body.error).toBe("INVALID_REQUEST");
  });

  it("returns 400 for malformed JSON string body", async () => {
    const req = makeReq({ body: "not-json{{{" });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(400);
    expect(res._body.error).toBe("INVALID_REQUEST");
  });

  it("returns 401 when no identity is available", async () => {
    const req = makeReq({ body: VALID_BODY, headers: {} });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(401);
    expect(res._body.error).toBe("UNAUTHORIZED");
  });

  it("returns 500 when persistence fails", async () => {
    process.env.TRAINELO_USER_ID = "test-user-id";
    vi.mocked(upsertDailyCheckin).mockResolvedValueOnce({
      success: false,
      error: "connection refused",
    });

    const req = makeReq({ body: VALID_BODY });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(500);
    expect(res._body.error).toBe("PERSISTENCE_FAILED");
  });

  it("returns 200 on success with ok, recorded_at, date", async () => {
    process.env.TRAINELO_USER_ID = "test-user-id";
    vi.mocked(upsertDailyCheckin).mockResolvedValueOnce({
      success: true,
      error: null,
    });

    const req = makeReq({ body: VALID_BODY });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._body.ok).toBe(true);
    expect(res._body.recorded_at).toBeDefined();
    expect(res._body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Verify upsert was called with correct params
    expect(upsertDailyCheckin).toHaveBeenCalledOnce();
    const params = vi.mocked(upsertDailyCheckin).mock.calls[0][0];
    expect(params.user_id).toBe("test-user-id");
    expect(params.mood).toBe("good");
  });

  it("passes optional fields through", async () => {
    process.env.TRAINELO_USER_ID = "test-user-id";
    vi.mocked(upsertDailyCheckin).mockResolvedValueOnce({
      success: true,
      error: null,
    });

    const body = {
      mood: "tired",
      rpe: 7,
      soreness: 4,
      pain_flag: true,
      illness_flag: false,
      notes: "left knee ache",
      date: "2026-02-09",
    };
    const req = makeReq({ body });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    const params = vi.mocked(upsertDailyCheckin).mock.calls[0][0];
    expect(params.mood).toBe("tired");
    expect(params.rpe).toBe(7);
    expect(params.soreness).toBe(4);
    expect(params.pain_flag).toBe(true);
    expect(params.illness_flag).toBe(false);
    expect(params.notes).toBe("left knee ache");
    expect(params.date).toBe("2026-02-09");
  });

  // -------------------------------------------------------------------------
  // v2 field tests
  // -------------------------------------------------------------------------

  it("passes v2 fields through to upsert", async () => {
    process.env.TRAINELO_USER_ID = "test-user-id";
    vi.mocked(upsertDailyCheckin).mockResolvedValueOnce({
      success: true,
      error: null,
    });

    const body = {
      mood: "drained",
      reason_bucket: "hurt",
      pain_severity: 7,
      pain_locations: ["knee", "ankle"],
      pain_flag: true,
      time_constraint_minutes: 30,
      reason_tags: ["soreness"],
      checkin_version: 2,
      payload: { upgrade_intent: false },
    };
    const req = makeReq({ body });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    const params = vi.mocked(upsertDailyCheckin).mock.calls[0][0];
    expect(params.reason_bucket).toBe("hurt");
    expect(params.pain_severity).toBe(7);
    expect(params.pain_locations).toEqual(["knee", "ankle"]);
    expect(params.time_constraint_minutes).toBe(30);
    expect(params.reason_tags).toEqual(["soreness"]);
    expect(params.checkin_version).toBe(2);
    expect(params.payload).toEqual({ upgrade_intent: false });
  });

  it("returns 400 for invalid reason_bucket value", async () => {
    process.env.TRAINELO_USER_ID = "test-user-id";
    const req = makeReq({ body: { mood: "drained", reason_bucket: "bored" } });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(400);
    expect(res._body.error).toBe("INVALID_REQUEST");
  });

  it("returns 400 for pain_severity out of range", async () => {
    process.env.TRAINELO_USER_ID = "test-user-id";
    const req = makeReq({ body: { mood: "drained", reason_bucket: "hurt", pain_severity: 11 } });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(400);
    expect(res._body.error).toBe("INVALID_REQUEST");
  });

  it("returns 400 for time_constraint_minutes < 1", async () => {
    process.env.TRAINELO_USER_ID = "test-user-id";
    const req = makeReq({ body: { mood: "okay", time_constraint_minutes: 0 } });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(400);
    expect(res._body.error).toBe("INVALID_REQUEST");
  });

  it("defaults checkin_version to 2 when not provided", async () => {
    process.env.TRAINELO_USER_ID = "test-user-id";
    vi.mocked(upsertDailyCheckin).mockResolvedValueOnce({
      success: true,
      error: null,
    });

    const req = makeReq({ body: { mood: "good" } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    const params = vi.mocked(upsertDailyCheckin).mock.calls[0][0];
    expect(params.checkin_version).toBe(2);
  });

  it("accepts v1-only payload without v2 fields (backward compat)", async () => {
    process.env.TRAINELO_USER_ID = "test-user-id";
    vi.mocked(upsertDailyCheckin).mockResolvedValueOnce({
      success: true,
      error: null,
    });

    const req = makeReq({ body: { mood: "great", rpe: 3 } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    const params = vi.mocked(upsertDailyCheckin).mock.calls[0][0];
    expect(params.mood).toBe("great");
    expect(params.rpe).toBe(3);
    // v2 fields should be undefined (not sent)
    expect(params.reason_bucket).toBeUndefined();
    expect(params.pain_severity).toBeUndefined();
    expect(params.pain_locations).toBeUndefined();
    expect(params.time_constraint_minutes).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Drained business-rule validation
  // -------------------------------------------------------------------------

  it("returns 400 VALIDATION_FAILED for drained without reason_bucket", async () => {
    process.env.TRAINELO_USER_ID = "test-user-id";
    const req = makeReq({ body: { mood: "drained" } });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(400);
    expect(res._body.error).toBe("VALIDATION_FAILED");
    expect(upsertDailyCheckin).not.toHaveBeenCalled();
  });

  it("returns 400 VALIDATION_FAILED for drained hurt without pain_severity", async () => {
    process.env.TRAINELO_USER_ID = "test-user-id";
    const req = makeReq({
      body: { mood: "drained", reason_bucket: "hurt", pain_locations: ["knee"] },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(400);
    expect(res._body.error).toBe("VALIDATION_FAILED");
    expect(upsertDailyCheckin).not.toHaveBeenCalled();
  });

  it("returns 400 VALIDATION_FAILED for drained hurt without pain_locations", async () => {
    process.env.TRAINELO_USER_ID = "test-user-id";
    const req = makeReq({
      body: { mood: "drained", reason_bucket: "hurt", pain_severity: 5 },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(400);
    expect(res._body.error).toBe("VALIDATION_FAILED");
    expect(upsertDailyCheckin).not.toHaveBeenCalled();
  });

  it("returns 200 for valid drained + hurt payload", async () => {
    process.env.TRAINELO_USER_ID = "test-user-id";
    vi.mocked(upsertDailyCheckin).mockResolvedValueOnce({
      success: true,
      error: null,
    });

    const req = makeReq({
      body: {
        mood: "drained",
        reason_bucket: "hurt",
        pain_severity: 5,
        pain_locations: ["knee"],
      },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(200);
    expect(res._body.ok).toBe(true);
  });

  it("returns 200 for valid drained + sick payload (no pain details needed)", async () => {
    process.env.TRAINELO_USER_ID = "test-user-id";
    vi.mocked(upsertDailyCheckin).mockResolvedValueOnce({
      success: true,
      error: null,
    });

    const req = makeReq({ body: { mood: "drained", reason_bucket: "sick" } });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(200);
    expect(res._body.ok).toBe(true);
  });

  // -------------------------------------------------------------------------
  // DB constraint violation → 400 VALIDATION_FAILED
  // -------------------------------------------------------------------------

  it("returns 400 VALIDATION_FAILED on DB check constraint violation (23514)", async () => {
    process.env.TRAINELO_USER_ID = "test-user-id";
    vi.mocked(upsertDailyCheckin).mockResolvedValueOnce({
      success: false,
      error: "new row violates check constraint",
      error_code: "23514",
    });

    const req = makeReq({ body: { mood: "good" } });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(400);
    expect(res._body.error).toBe("VALIDATION_FAILED");
  });

  it("returns 500 PERSISTENCE_FAILED on non-constraint DB error", async () => {
    process.env.TRAINELO_USER_ID = "test-user-id";
    vi.mocked(upsertDailyCheckin).mockResolvedValueOnce({
      success: false,
      error: "connection refused",
      error_code: null,
    });

    const req = makeReq({ body: { mood: "good" } });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(500);
    expect(res._body.error).toBe("PERSISTENCE_FAILED");
  });

  // -------------------------------------------------------------------------
  // Calibration in response
  // -------------------------------------------------------------------------

  it("returns calibration field in success response", async () => {
    process.env.TRAINELO_USER_ID = "test-user-id";
    vi.mocked(upsertDailyCheckin).mockResolvedValueOnce({
      success: true,
      error: null,
    });

    const req = makeReq({ body: { mood: "good" } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._body).toHaveProperty("calibration");
    // Calibration runs the pure calibrator even with no wearable data
    const cal = res._body.calibration;
    if (cal) {
      expect(cal).toHaveProperty("level");
      expect(cal).toHaveProperty("intensity_multiplier");
      expect(cal).toHaveProperty("duration_multiplier");
      expect(cal).toHaveProperty("swap_to");
      expect(cal).toHaveProperty("applied_rules");
    }
  });

  it("returns calibration with red level for drained + sick", async () => {
    process.env.TRAINELO_USER_ID = "test-user-id";
    vi.mocked(upsertDailyCheckin).mockResolvedValueOnce({
      success: true,
      error: null,
    });

    const req = makeReq({
      body: { mood: "drained", reason_bucket: "sick", illness_flag: true },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._body.ok).toBe(true);
    const cal = res._body.calibration;
    expect(cal).not.toBeNull();
    expect(cal.level).toBe("red");
    expect(cal.swap_to).toBe("rest");
    expect(cal.applied_rules).toContain("HARD_STOP:ILLNESS_FLAG");
  });

  it("returns calibration with green level for good mood", async () => {
    process.env.TRAINELO_USER_ID = "test-user-id";
    vi.mocked(upsertDailyCheckin).mockResolvedValueOnce({
      success: true,
      error: null,
    });

    const req = makeReq({ body: { mood: "good" } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    const cal = res._body.calibration;
    expect(cal).not.toBeNull();
    expect(cal.level).toBe("green");
    expect(cal.swap_to).toBe("as_planned");
    expect(cal.applied_rules).toContain("MOOD_GOOD");
  });
});
