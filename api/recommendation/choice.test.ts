/**
 * Tests for POST /api/recommendation/choice handler.
 *
 * Mocks VercelRequest/VercelResponse and the DB insert function
 * to verify routing, validation, auth gating, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DB insert before importing the handler
vi.mock("../../src/lib/db/queries.js", () => ({
  insertRecommendationEvent: vi.fn(),
}));

// Mock @supabase/supabase-js to prevent real client creation
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({})),
}));

import handler from "./choice";
import { insertRecommendationEvent } from "../../src/lib/db/queries.js";

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

const VALID_BODY = {
  recommendation_id: "user-123:2025-01-15",
  chosen_candidate_id: "scheduled",
  action: "accept",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/recommendation/choice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env
    delete process.env.TRAINELO_USER_ID;
  });

  it("returns 405 for non-POST methods", async () => {
    const req = makeReq({ method: "GET" });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(405);
    expect(res._body.error).toBe("Method not allowed");
  });

  it("returns 400 for invalid body", async () => {
    const req = makeReq({ body: { recommendation_id: "" } });
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
    vi.mocked(insertRecommendationEvent).mockResolvedValueOnce({
      success: false,
      duplicate: false,
      error: "connection refused",
    });

    const req = makeReq({ body: VALID_BODY });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(500);
    expect(res._body.error).toBe("PERSISTENCE_FAILED");
  });

  it("returns 200 with ChoiceResponse on success", async () => {
    process.env.TRAINELO_USER_ID = "test-user-id";
    vi.mocked(insertRecommendationEvent).mockResolvedValueOnce({
      success: true,
      duplicate: false,
      error: null,
    });

    const req = makeReq({ body: VALID_BODY });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._body.schema_version).toBe("v1");
    expect(res._body.recorded).toBe(true);
    expect(res._body.recorded_at).toBeDefined();

    // Verify insert was called with correct params
    expect(insertRecommendationEvent).toHaveBeenCalledOnce();
    const params = vi.mocked(insertRecommendationEvent).mock.calls[0][0];
    expect(params.user_id).toBe("test-user-id");
    expect(params.recommendation_id).toBe("user-123:2025-01-15");
    expect(params.chosen_candidate_id).toBe("scheduled");
    expect(params.action).toBe("accept");
    expect(params.note).toBeNull();
  });

  it("returns 200 (idempotent) on duplicate submission (23505)", async () => {
    process.env.TRAINELO_USER_ID = "test-user-id";
    vi.mocked(insertRecommendationEvent).mockResolvedValueOnce({
      success: true,
      duplicate: true,
      error: null,
    });

    const req = makeReq({ body: VALID_BODY });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._body.schema_version).toBe("v1");
    expect(res._body.recorded).toBe(true);
    expect(res._body.recorded_at).toBeDefined();
  });

  it("passes note through when provided", async () => {
    process.env.TRAINELO_USER_ID = "test-user-id";
    vi.mocked(insertRecommendationEvent).mockResolvedValueOnce({
      success: true,
      duplicate: false,
      error: null,
    });

    const bodyWithNote = { ...VALID_BODY, note: "feeling good" };
    const req = makeReq({ body: bodyWithNote });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    const params = vi.mocked(insertRecommendationEvent).mock.calls[0][0];
    expect(params.note).toBe("feeling good");
  });
});
