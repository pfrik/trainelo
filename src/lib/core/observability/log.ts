/**
 * Lightweight structured logger + timer utility.
 * No dependencies, no framework — JSON lines to stdout/stderr.
 */

export interface Logger {
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
}

function formatLine(
  route: string,
  level: "info" | "warn" | "error",
  msg: string,
  data?: Record<string, unknown>,
): string {
  return JSON.stringify({ ts: new Date().toISOString(), route, level, msg, ...data });
}

export function createLogger(route: string): Logger {
  return {
    info(msg, data) {
      console.log(formatLine(route, "info", msg, data));
    },
    warn(msg, data) {
      console.warn(formatLine(route, "warn", msg, data));
    },
    error(msg, data) {
      console.error(formatLine(route, "error", msg, data));
    },
  };
}

export function timer(): { elapsed(): number } {
  const start = performance.now();
  return { elapsed: () => Math.round((performance.now() - start) * 100) / 100 };
}
