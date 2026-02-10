/**
 * Tests for POST /api/user-flags handler.
 *
 * Mocks VercelRequest/VercelResponse and the DB upsert function
 * to verify routing, validation, auth gating, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DB upsert before importing the handler
vi.mock("../src/lib/db/queries.js", () => ({
  upsertDailyCheckin: vi.fn(),
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
});
