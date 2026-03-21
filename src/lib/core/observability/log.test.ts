import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLogger, timer } from "./log";

describe("createLogger", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("info writes valid JSON with route, level, and msg", () => {
    const log = createLogger("test-route");
    log.info("hello");

    expect(logSpy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(parsed.route).toBe("test-route");
    expect(parsed.level).toBe("info");
    expect(parsed.msg).toBe("hello");
    expect(parsed.ts).toBeDefined();
  });

  it("warn uses console.warn", () => {
    const log = createLogger("r");
    log.warn("watch out");

    expect(warnSpy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(warnSpy.mock.calls[0][0] as string);
    expect(parsed.level).toBe("warn");
  });

  it("error uses console.error", () => {
    const log = createLogger("r");
    log.error("boom");

    expect(errorSpy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(parsed.level).toBe("error");
  });

  it("merges extra data into the JSON line", () => {
    const log = createLogger("r");
    log.info("with data", { user_id: "abc", count: 3 });

    const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(parsed.user_id).toBe("abc");
    expect(parsed.count).toBe(3);
    expect(parsed.msg).toBe("with data");
  });
});

describe("timer", () => {
  it("returns elapsed ms >= 0", () => {
    const t = timer();
    const ms = t.elapsed();
    expect(ms).toBeGreaterThanOrEqual(0);
    expect(typeof ms).toBe("number");
  });

  it("increases over time", async () => {
    const t = timer();
    // Busy-wait a tiny bit to ensure non-zero elapsed
    const start = performance.now();
    while (performance.now() - start < 2) {
      /* spin */
    }
    expect(t.elapsed()).toBeGreaterThan(0);
  });
});
