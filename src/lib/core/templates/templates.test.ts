import { describe, it, expect } from "vitest";
import { TEMPLATES } from "./workoutTemplates";
import { resolveTemplate } from "./resolveTemplate";
import { applyCalibratedTemplate } from "./applyCalibratedTemplate";

// ============================================================================
// Template Library
// ============================================================================

describe("TEMPLATES", () => {
  it("contains all expected template refs", () => {
    const refs = TEMPLATES.map((t) => t.template_ref);
    expect(refs).toContain("easy-run-30min");
    expect(refs).toContain("recovery-jog-20min");
    expect(refs).toContain("tempo-run-45min");
    expect(refs).toContain("long-run-90min");
    expect(refs).toContain("interval-8x400");
    expect(refs).toContain("strength-lower-45min");
    expect(refs).toContain("mobility-20min");
  });

  it("all templates have at least one segment", () => {
    for (const t of TEMPLATES) {
      expect(t.segments.length).toBeGreaterThan(0);
    }
  });

  it("segment durations sum to total_duration_minutes", () => {
    for (const t of TEMPLATES) {
      const sum = t.segments.reduce((s, seg) => s + seg.duration_minutes, 0);
      expect(sum).toBe(t.total_duration_minutes);
    }
  });

  it("all templates have valid rpe_target (1-10)", () => {
    for (const t of TEMPLATES) {
      expect(t.rpe_target).toBeGreaterThanOrEqual(1);
      expect(t.rpe_target).toBeLessThanOrEqual(10);
    }
  });
});

// ============================================================================
// resolveTemplate
// ============================================================================

describe("resolveTemplate", () => {
  it("resolves known template ref", () => {
    const result = resolveTemplate("easy-run-30min");
    expect(result).not.toBeNull();
    expect(result!.label).toBe("Easy Run (30 min)");
  });

  it("returns null for unknown ref", () => {
    expect(resolveTemplate("unknown-template")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(resolveTemplate(null)).toBeNull();
  });
});

// ============================================================================
// applyCalibratedTemplate
// ============================================================================

describe("applyCalibratedTemplate", () => {
  const template = resolveTemplate("easy-run-30min")!;

  it("returns unmodified values with 1.0 multipliers", () => {
    const result = applyCalibratedTemplate(template, 1.0, 1.0);
    expect(result.total_duration_minutes).toBe(30);
    expect(result.target_km).toBe(4.5);
    expect(result.rpe_target).toBe(4);
    expect(result.intensity_multiplier).toBe(1.0);
    expect(result.duration_multiplier).toBe(1.0);
  });

  it("scales duration down with 0.7 multiplier", () => {
    const result = applyCalibratedTemplate(template, 1.0, 0.7);
    // 5*0.7=3.5→4, 20*0.7=14, 5*0.7=3.5→4 = 22 total
    expect(result.total_duration_minutes).toBeLessThan(30);
    expect(result.duration_multiplier).toBe(0.7);
  });

  it("scales intensity down with 0.85 multiplier", () => {
    const result = applyCalibratedTemplate(template, 0.85, 1.0);
    expect(result.intensity_multiplier).toBe(0.85);
    // Main segment target_intensity 55 * 0.85 = 46.75 → 47
    const mainSeg = result.segments.find((s) => s.type === "main");
    expect(mainSeg!.target_intensity).toBe(47);
  });

  it("clamps rpe_target between 1 and 10", () => {
    const highIntensity = applyCalibratedTemplate(template, 3.0, 1.0);
    expect(highIntensity.rpe_target).toBeLessThanOrEqual(10);

    const lowIntensity = applyCalibratedTemplate(template, 0.1, 1.0);
    expect(lowIntensity.rpe_target).toBeGreaterThanOrEqual(1);
  });

  it("scales target_km proportionally to duration", () => {
    const result = applyCalibratedTemplate(template, 1.0, 0.5);
    expect(result.target_km).toBeCloseTo(2.25, 1);
  });

  it("handles null target_km (strength template)", () => {
    const strength = resolveTemplate("strength-lower-45min")!;
    const result = applyCalibratedTemplate(strength, 0.8, 0.8);
    expect(result.target_km).toBeNull();
  });

  it("ensures minimum 1 minute per segment", () => {
    const result = applyCalibratedTemplate(template, 1.0, 0.01);
    for (const seg of result.segments) {
      expect(seg.duration_minutes).toBeGreaterThanOrEqual(1);
    }
  });
});
