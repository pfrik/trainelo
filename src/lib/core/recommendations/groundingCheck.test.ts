import { describe, it, expect } from "vitest";
import {
  extractNumbers,
  findUngroundedNumbers,
  findUngroundedMetricClaims,
  groundingViolations,
} from "./groundingCheck.js";

describe("extractNumbers", () => {
  it("pulls integers and decimals in order", () => {
    expect(extractNumbers("40 min at 4.7 effort, 80%")).toEqual(["40", "4.7", "80"]);
  });

  it("returns empty for prose with no digits", () => {
    expect(extractNumbers("your body is recovering well")).toEqual([]);
  });
});

describe("findUngroundedNumbers", () => {
  it("passes when every number in the text is present in the context", () => {
    const context = "Fatigue: 40/100\nSleep quality: 75/100\nToday's session: 40 min";
    const text = "Fatigue is 40 and sleep was 75, so this 40 minute session fits.";
    expect(findUngroundedNumbers(text, context)).toEqual([]);
  });

  it("flags a number the model invented", () => {
    const context = "HRV trend: declining\nFatigue: 62/100";
    // "58" (a made-up resting HR) is nowhere in the evidence.
    const text = "Your resting HR of 58 is elevated; fatigue at 62 says go easy.";
    expect(findUngroundedNumbers(text, context)).toEqual(["58"]);
  });

  it("does not match a number as a substring of a larger number", () => {
    const context = "Days since last rest day: 2";
    const text = "You have trained 42 hours"; // 42 must not be 'grounded' by the 2
    expect(findUngroundedNumbers(text, context)).toEqual(["42"]);
  });

  it("ignores spelled-out numbers (conservative, no false positives)", () => {
    const context = "Consecutive days flagged: 3";
    const text = "HRV suppressed for three days straight";
    expect(findUngroundedNumbers(text, context)).toEqual([]);
  });

  it("dedupes repeated ungrounded numbers", () => {
    const context = "Fatigue: 40/100";
    const text = "RHR 58 this morning; still 58 by noon";
    expect(findUngroundedNumbers(text, context)).toEqual(["58"]);
  });
});

describe("findUngroundedMetricClaims", () => {
  it("flags a resting-HR narrative when RHR is nowhere in the evidence", () => {
    const context = "HRV trend: declining\nFatigue: 68/100\nSleep quality: 60/100";
    const text = "Your resting heart rate is running a bit high, so go easy today.";
    expect(findUngroundedMetricClaims(text, context)).toEqual(["resting heart rate"]);
  });

  it("does NOT flag RHR when it's present via a reason code", () => {
    // buildUserPrompt emits reason codes into the context; RHR_ELEVATED grounds the claim.
    const context = "Reason codes: RHR_ELEVATED\nFatigue: 68/100";
    const text = "Your resting heart rate is elevated today.";
    expect(findUngroundedMetricClaims(text, context)).toEqual([]);
  });

  it("does not fire on idiomatic coaching language", () => {
    const context = "Fatigue: 40/100\nSleep quality: 75/100";
    const text = "You're in good shape and recovering well — a solid day to train.";
    expect(findUngroundedMetricClaims(text, context)).toEqual([]);
  });

  it("grounds HRV / training-load claims when those signals are provided", () => {
    const context = "HRV trend: rising\nEWMA Fatigue: 42\nAlready trained today (65 TSS)";
    const text = "Your HRV is trending up and you've banked 65 TSS of load already.";
    expect(findUngroundedMetricClaims(text, context)).toEqual([]);
  });
});

describe("groundingViolations", () => {
  it("combines number and metric violations into readable strings", () => {
    const context = "Fatigue: 40/100";
    const text = "Your resting heart rate of 58 is high.";
    expect(groundingViolations(text, context)).toEqual([
      'number 58',
      'metric "resting heart rate"',
    ]);
  });

  it("is empty for a fully grounded explanation", () => {
    const context = "Fatigue: 40/100\nSleep quality: 75/100\nToday: 40 min";
    const text = "Fatigue at 40 and solid sleep mean this 40 minute session fits.";
    expect(groundingViolations(text, context)).toEqual([]);
  });
});
