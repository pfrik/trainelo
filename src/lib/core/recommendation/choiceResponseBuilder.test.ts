import { describe, it, expect } from "vitest";
import { buildChoiceResponse } from "./choiceResponseBuilder";
import { ChoiceResponseSchema } from "../contracts";

describe("buildChoiceResponse", () => {
  const input = {
    recorded_at: "2025-01-15T08:30:00.000Z",
  };

  it("returns response with correct schema version", () => {
    const response = buildChoiceResponse(input);
    expect(response.schema_version).toBe("v1");
  });

  it("returns recorded: true", () => {
    const response = buildChoiceResponse(input);
    expect(response.recorded).toBe(true);
  });

  it("uses input recorded_at timestamp", () => {
    const response = buildChoiceResponse(input);
    expect(response.recorded_at).toBe("2025-01-15T08:30:00.000Z");
  });

  it("is deterministic (same input produces same output)", () => {
    const response1 = buildChoiceResponse(input);
    const response2 = buildChoiceResponse(input);
    expect(response1).toEqual(response2);
  });

  it("passes schema validation", () => {
    const response = buildChoiceResponse(input);
    const result = ChoiceResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it("uses different timestamps correctly", () => {
    const customInput = {
      recorded_at: "2025-06-20T14:45:00.000Z",
    };
    const response = buildChoiceResponse(customInput);
    expect(response.recorded_at).toBe("2025-06-20T14:45:00.000Z");
  });
});
