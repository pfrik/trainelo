import { describe, it, expect } from "vitest";
import {
  transformActivity,
  getGarminSourceRef,
  mapActivityType,
} from "./transformActivity.js";
import type { IntervalsActivity } from "./types.js";

const USER_ID = "00000000-0000-0000-0000-000000000001";

/** Real activity shape captured from the intervals.icu API (Garmin pool swim). */
function makeGarminSwim(overrides: Partial<IntervalsActivity> = {}): IntervalsActivity {
  return {
    id: "i161742359",
    external_id: "23440166400",
    strava_id: null,
    source: "GARMIN_CONNECT",
    type: "Swim",
    sub_type: null,
    name: "Pool Swim",
    start_date: "2026-07-01T09:33:58Z",
    start_date_local: "2026-07-01T11:33:58",
    moving_time: 1751,
    elapsed_time: 3512,
    distance: 1750,
    calories: 571,
    average_heartrate: 126,
    max_heartrate: 164,
    average_cadence: 18.672758,
    icu_average_watts: null,
    icu_weighted_avg_watts: null,
    icu_training_load: 16,
    icu_intensity: 40.503807,
    icu_rpe: null,
    feel: null,
    total_elevation_gain: null,
    total_elevation_loss: null,
    average_speed: 1,
    max_speed: 1.37,
    pool_length: 50,
    ...overrides,
  };
}

/** Real Dropbox-sourced virtual ride (non-Garmin origin). */
function makeDropboxRide(): IntervalsActivity {
  return {
    id: "i161597853",
    external_id: "littlechinaman-2026-06-30-mount-baldy-3-423942488.fit",
    source: "DROPBOX",
    type: "VirtualRide",
    name: "Mount Baldy-3",
    start_date: "2026-06-30T18:15:40Z",
    moving_time: 3599,
    elapsed_time: 3600,
    distance: 18329.72,
    calories: 823,
    average_heartrate: 141,
    max_heartrate: 164,
    average_cadence: 81.47209,
    icu_average_watts: 230,
    icu_weighted_avg_watts: 262,
    icu_training_load: 90,
    icu_intensity: 94.927536,
    trainer: true,
  };
}

describe("getGarminSourceRef", () => {
  it("returns the numeric Garmin ID for GARMIN_CONNECT activities", () => {
    expect(getGarminSourceRef(makeGarminSwim())).toBe("23440166400");
  });

  it("returns null for non-Garmin sources even with an external_id", () => {
    expect(getGarminSourceRef(makeDropboxRide())).toBeNull();
  });

  it("returns null when the external_id is not a plain numeric ID", () => {
    expect(
      getGarminSourceRef(makeGarminSwim({ external_id: "1234.fit" })),
    ).toBeNull();
    expect(getGarminSourceRef(makeGarminSwim({ external_id: null }))).toBeNull();
  });
});

describe("mapActivityType", () => {
  it("maps intervals.icu sport types to the canonical vocabulary", () => {
    expect(mapActivityType("Ride")).toBe("bike");
    expect(mapActivityType("VirtualRide")).toBe("bike_indoor");
    expect(mapActivityType("MountainBikeRide")).toBe("bike_mtb");
    expect(mapActivityType("Run")).toBe("run");
    expect(mapActivityType("Swim")).toBe("swim_pool");
    expect(mapActivityType("OpenWaterSwim")).toBe("swim_open");
    expect(mapActivityType("WeightTraining")).toBe("strength");
  });

  it("falls back to other for unknown or missing types", () => {
    expect(mapActivityType("Wheelchair")).toBe("other");
    expect(mapActivityType(null)).toBe("other");
    expect(mapActivityType(undefined)).toBe("other");
  });
});

describe("transformActivity", () => {
  it("maps a Garmin pool swim to a canonical workouts row", () => {
    const row = transformActivity(makeGarminSwim(), USER_ID);
    expect(row).toMatchObject({
      user_id: USER_ID,
      source: "intervals_icu",
      source_ref: "i161742359",
      activity_type: "swim_pool",
      title: "Pool Swim",
      started_at: "2026-07-01T09:33:58Z",
      ended_at: "2026-07-01T10:32:30.000Z", // start + 3512s elapsed
      duration_seconds: 3512,
      moving_duration_seconds: 1751,
      elapsed_duration_seconds: 3512,
      distance_meters: 1750,
      calories: 571,
      avg_heart_rate: 126,
      max_heart_rate: 164,
      avg_cadence: 19,
      training_stress_score: 16,
      intensity_factor: 0.405,
      avg_speed_mps: 1,
      max_speed_mps: 1.37,
      perceived_exertion: null,
    });
    expect(row.raw_data).toBeDefined();
  });

  it("maps power fields and IF for a virtual ride", () => {
    const row = transformActivity(makeDropboxRide(), USER_ID);
    expect(row).toMatchObject({
      activity_type: "bike_indoor",
      avg_power_watts: 230,
      normalized_power_watts: 262,
      training_stress_score: 90,
      intensity_factor: 0.949,
    });
  });

  it("falls back to moving_time for duration when elapsed_time is missing", () => {
    const row = transformActivity(
      makeGarminSwim({ elapsed_time: null }),
      USER_ID,
    );
    expect(row.duration_seconds).toBe(1751);
  });

  it("passes through RPE only when in the 1-10 range", () => {
    expect(
      transformActivity(makeGarminSwim({ icu_rpe: 7 }), USER_ID).perceived_exertion,
    ).toBe(7);
    expect(
      transformActivity(makeGarminSwim({ icu_rpe: 0 }), USER_ID).perceived_exertion,
    ).toBeNull();
  });

  it("throws when the start date is missing or unparseable", () => {
    expect(() =>
      transformActivity(makeGarminSwim({ start_date: null }), USER_ID),
    ).toThrow(/start_date/);
    expect(() =>
      transformActivity(makeGarminSwim({ start_date: "not-a-date" }), USER_ID),
    ).toThrow(/start_date/);
  });
});
