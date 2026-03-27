import { describe, it, expect } from "vitest";
import { normalizeSport, sportToDisplayKey } from "./normalizeSport";

describe("normalizeSport", () => {
  it("detects running variants", () => {
    expect(normalizeSport("RUNNING")).toBe("running");
    expect(normalizeSport("running")).toBe("running");
    expect(normalizeSport("TREADMILL_RUNNING")).toBe("running");
    expect(normalizeSport("TRAIL_RUNNING")).toBe("running");
    expect(normalizeSport("jogging")).toBe("running");
    expect(normalizeSport("walking")).toBe("running");
    expect(normalizeSport("HIKING")).toBe("running");
  });

  it("detects cycling variants", () => {
    expect(normalizeSport("CYCLING")).toBe("cycling");
    expect(normalizeSport("cycling")).toBe("cycling");
    expect(normalizeSport("INDOOR_CYCLING")).toBe("cycling");
    expect(normalizeSport("VIRTUAL_RIDE")).toBe("cycling");
    expect(normalizeSport("mountain_biking")).toBe("cycling");
    expect(normalizeSport("bike")).toBe("cycling");
  });

  it("detects swimming variants", () => {
    expect(normalizeSport("SWIMMING")).toBe("swimming");
    expect(normalizeSport("POOL_SWIMMING")).toBe("swimming");
    expect(normalizeSport("OPEN_WATER_SWIMMING")).toBe("swimming");
    expect(normalizeSport("open_water")).toBe("swimming");
  });

  it("detects strength variants", () => {
    expect(normalizeSport("STRENGTH_TRAINING")).toBe("strength");
    expect(normalizeSport("strength")).toBe("strength");
    expect(normalizeSport("gym")).toBe("strength");
    expect(normalizeSport("CORE_TRAINING")).toBe("strength");
    expect(normalizeSport("weight_training")).toBe("strength");
    expect(normalizeSport("fitness_equipment")).toBe("strength");
    expect(normalizeSport("yoga")).toBe("strength");
    expect(normalizeSport("pilates")).toBe("strength");
  });

  it("returns 'other' for unknown types", () => {
    expect(normalizeSport("ROWING")).toBe("other");
    expect(normalizeSport("soccer")).toBe("other");
    expect(normalizeSport("tennis")).toBe("other");
    expect(normalizeSport("")).toBe("other");
    expect(normalizeSport("UNKNOWN")).toBe("other");
  });

  it("is case-insensitive", () => {
    expect(normalizeSport("Running")).toBe("running");
    expect(normalizeSport("CYCLING")).toBe("cycling");
    expect(normalizeSport("Swimming")).toBe("swimming");
  });
});

describe("sportToDisplayKey", () => {
  it("maps canonical sports to UI display keys", () => {
    expect(sportToDisplayKey("running")).toBe("run");
    expect(sportToDisplayKey("cycling")).toBe("bike");
    expect(sportToDisplayKey("swimming")).toBe("swim");
    expect(sportToDisplayKey("strength")).toBe("strength");
    expect(sportToDisplayKey("other")).toBe("other");
  });
});
