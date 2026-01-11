/**
 * Unit tests for blobStore helper functions.
 *
 * Tests focus on pure functions (generatePayloadHash, generateBlobKey)
 * since they don't require Supabase connection.
 */

import { describe, it, expect } from "vitest";
import { generatePayloadHash, generateBlobKey } from "../blobStore";

describe("blobStore", () => {
  describe("generatePayloadHash", () => {
    it("returns a 64-character hex string (SHA256)", () => {
      const payload = { foo: "bar" };
      const hash = generatePayloadHash(payload);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it("is deterministic - same input produces same output", () => {
      const payload = { foo: "bar", count: 42, nested: { a: 1, b: 2 } };

      const hash1 = generatePayloadHash(payload);
      const hash2 = generatePayloadHash(payload);
      const hash3 = generatePayloadHash(payload);

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });

    it("produces different hashes for different payloads", () => {
      const payload1 = { foo: "bar" };
      const payload2 = { foo: "baz" };
      const payload3 = { bar: "foo" };

      const hash1 = generatePayloadHash(payload1);
      const hash2 = generatePayloadHash(payload2);
      const hash3 = generatePayloadHash(payload3);

      expect(hash1).not.toBe(hash2);
      expect(hash2).not.toBe(hash3);
      expect(hash1).not.toBe(hash3);
    });

    it("produces same hash regardless of key order in payload", () => {
      const payload1 = { a: 1, b: 2, c: 3 };
      const payload2 = { c: 3, a: 1, b: 2 };
      const payload3 = { b: 2, c: 3, a: 1 };

      const hash1 = generatePayloadHash(payload1);
      const hash2 = generatePayloadHash(payload2);
      const hash3 = generatePayloadHash(payload3);

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });

    it("handles complex nested objects", () => {
      const payload = {
        activityId: "12345",
        summary: {
          duration: 3600,
          distance: 10000,
          avgHeartRate: 145,
        },
        laps: [
          { duration: 1800, distance: 5000 },
          { duration: 1800, distance: 5000 },
        ],
      };

      const hash = generatePayloadHash(payload);

      expect(hash).toHaveLength(64);
      // Same payload should produce same hash
      expect(generatePayloadHash(payload)).toBe(hash);
    });

    it("handles empty objects", () => {
      const hash = generatePayloadHash({});

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe("generateBlobKey", () => {
    const baseParams = {
      userId: "user-123",
      provider: "garmin",
      date: "2024-01-15",
      externalId: "activity-456",
      hash: "abc123def456abc123def456abc123def456abc123def456abc123def456abcd",
    };

    it("produces correct format: raw/{provider}/{userId}/{date}/{externalId}_{hash}.json", () => {
      const key = generateBlobKey(baseParams);

      expect(key).toBe(
        "raw/garmin/user-123/2024-01-15/activity-456_abc123def456abc123def456abc123def456abc123def456abc123def456abcd.json"
      );
    });

    it("is deterministic - same params produce same key", () => {
      const key1 = generateBlobKey(baseParams);
      const key2 = generateBlobKey(baseParams);
      const key3 = generateBlobKey({ ...baseParams });

      expect(key1).toBe(key2);
      expect(key2).toBe(key3);
    });

    it("handles different providers", () => {
      const garminKey = generateBlobKey({ ...baseParams, provider: "garmin" });
      const stravaKey = generateBlobKey({ ...baseParams, provider: "strava" });
      const manualKey = generateBlobKey({ ...baseParams, provider: "manual" });

      expect(garminKey).toContain("/garmin/");
      expect(stravaKey).toContain("/strava/");
      expect(manualKey).toContain("/manual/");
    });

    it("sanitizes special characters in path components", () => {
      const key = generateBlobKey({
        ...baseParams,
        userId: "user/with/../slashes",
        provider: "bad..provider",
        externalId: "id<with>special&chars",
      });

      // Should not contain any path traversal or special characters
      expect(key).not.toContain("..");
      expect(key).not.toContain("<");
      expect(key).not.toContain(">");
      expect(key).not.toContain("&");

      // Should replace with underscores
      // "user/with/../slashes" -> "user_with____slashes" (4 underscores: /, ., ., /)
      expect(key).toContain("user_with____slashes");
      expect(key).toContain("bad__provider");
      expect(key).toContain("id_with_special_chars");
    });

    it("throws on invalid date format", () => {
      expect(() =>
        generateBlobKey({ ...baseParams, date: "01-15-2024" })
      ).toThrow("Invalid date format");

      expect(() =>
        generateBlobKey({ ...baseParams, date: "2024/01/15" })
      ).toThrow("Invalid date format");

      expect(() =>
        generateBlobKey({ ...baseParams, date: "2024-1-5" })
      ).toThrow("Invalid date format");

      expect(() =>
        generateBlobKey({ ...baseParams, date: "not-a-date" })
      ).toThrow("Invalid date format");
    });

    it("allows valid date formats", () => {
      // These should not throw
      expect(() =>
        generateBlobKey({ ...baseParams, date: "2024-01-01" })
      ).not.toThrow();
      expect(() =>
        generateBlobKey({ ...baseParams, date: "2024-12-31" })
      ).not.toThrow();
      expect(() =>
        generateBlobKey({ ...baseParams, date: "2025-06-15" })
      ).not.toThrow();
    });

    it("produces unique keys for different external IDs", () => {
      const key1 = generateBlobKey({ ...baseParams, externalId: "activity-1" });
      const key2 = generateBlobKey({ ...baseParams, externalId: "activity-2" });

      expect(key1).not.toBe(key2);
    });

    it("produces unique keys for different dates", () => {
      const key1 = generateBlobKey({ ...baseParams, date: "2024-01-15" });
      const key2 = generateBlobKey({ ...baseParams, date: "2024-01-16" });

      expect(key1).not.toBe(key2);
    });

    it("produces unique keys for different users", () => {
      const key1 = generateBlobKey({ ...baseParams, userId: "user-1" });
      const key2 = generateBlobKey({ ...baseParams, userId: "user-2" });

      expect(key1).not.toBe(key2);
    });
  });

  describe("integration: hash + key generation", () => {
    it("same payload always produces same full key path", () => {
      const payload = { activityId: "garmin-123", duration: 3600 };
      const params = {
        userId: "user-abc",
        provider: "garmin" as const,
        date: "2024-01-15",
        externalId: "garmin-123",
      };

      const hash1 = generatePayloadHash(payload);
      const key1 = generateBlobKey({ ...params, hash: hash1 });

      const hash2 = generatePayloadHash(payload);
      const key2 = generateBlobKey({ ...params, hash: hash2 });

      expect(key1).toBe(key2);
    });

    it("different payload produces different key (via hash)", () => {
      const params = {
        userId: "user-abc",
        provider: "garmin" as const,
        date: "2024-01-15",
        externalId: "garmin-123",
      };

      const hash1 = generatePayloadHash({ foo: "bar" });
      const hash2 = generatePayloadHash({ foo: "baz" });

      const key1 = generateBlobKey({ ...params, hash: hash1 });
      const key2 = generateBlobKey({ ...params, hash: hash2 });

      expect(key1).not.toBe(key2);
    });
  });
});
