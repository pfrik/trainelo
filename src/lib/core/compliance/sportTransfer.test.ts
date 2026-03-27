import { describe, it, expect } from "vitest";
import { getTransferCoefficient, computeTransferredTss, DEFAULT_TRANSFER_MATRIX } from "./sportTransfer";

describe("getTransferCoefficient", () => {
  it("returns 1.0 for same sport", () => {
    expect(getTransferCoefficient("running", "running")).toBe(1.0);
    expect(getTransferCoefficient("cycling", "cycling")).toBe(1.0);
    expect(getTransferCoefficient("swimming", "swimming")).toBe(1.0);
  });

  it("returns cycling → running = 0.6", () => {
    expect(getTransferCoefficient("cycling", "running")).toBe(0.6);
  });

  it("returns running → cycling = 0.5", () => {
    expect(getTransferCoefficient("running", "cycling")).toBe(0.5);
  });

  it("returns swimming → running = 0.3", () => {
    expect(getTransferCoefficient("swimming", "running")).toBe(0.3);
  });

  it("returns strength → running = 0.4", () => {
    expect(getTransferCoefficient("strength", "running")).toBe(0.4);
  });

  it("uses default for unknown target sport", () => {
    expect(getTransferCoefficient("cycling", "other")).toBe(0.5);
    expect(getTransferCoefficient("swimming", "other")).toBe(0.3);
  });

  it("uses other row for unknown source sport", () => {
    expect(getTransferCoefficient("other", "running")).toBe(0.5);
  });

  it("accepts custom matrix", () => {
    const custom = { cycling: { running: 0.9, default: 0.1 } };
    expect(getTransferCoefficient("cycling", "running", custom)).toBe(0.9);
    expect(getTransferCoefficient("cycling", "swimming", custom)).toBe(0.1);
  });
});

describe("computeTransferredTss", () => {
  it("returns full TSS for same sport", () => {
    expect(computeTransferredTss("running", "running", 100)).toBe(100);
  });

  it("discounts cross-sport TSS", () => {
    // cycling → running at 0.6
    expect(computeTransferredTss("cycling", "running", 100)).toBe(60);
  });

  it("handles zero TSS", () => {
    expect(computeTransferredTss("cycling", "running", 0)).toBe(0);
  });

  it("handles large TSS values", () => {
    expect(computeTransferredTss("cycling", "running", 250)).toBe(150);
  });
});

describe("DEFAULT_TRANSFER_MATRIX", () => {
  it("has entries for all primary sports", () => {
    expect(DEFAULT_TRANSFER_MATRIX).toHaveProperty("cycling");
    expect(DEFAULT_TRANSFER_MATRIX).toHaveProperty("running");
    expect(DEFAULT_TRANSFER_MATRIX).toHaveProperty("swimming");
    expect(DEFAULT_TRANSFER_MATRIX).toHaveProperty("strength");
    expect(DEFAULT_TRANSFER_MATRIX).toHaveProperty("other");
  });

  it("all coefficients are between 0 and 1", () => {
    for (const [, targets] of Object.entries(DEFAULT_TRANSFER_MATRIX)) {
      for (const [, coeff] of Object.entries(targets)) {
        expect(coeff).toBeGreaterThanOrEqual(0);
        expect(coeff).toBeLessThanOrEqual(1);
      }
    }
  });
});
