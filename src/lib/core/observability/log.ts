/**
 * Lightweight structured logger + timer utility.
 * No dependencies, no framework — JSON lines to stdout/stderr.
 *
 * Features:
 *  - Request-scoped correlation IDs (optional)
 *  - LOG_LEVEL env var filtering (default: "info")
 */

export interface Logger {
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
}

const LEVELS = { info: 0, warn: 1, error: 2 } as const;

function getMinLevel(): number {
  const env = (typeof process !== "undefined" && process.env?.LOG_LEVEL) || "info";
  return LEVELS[env as keyof typeof LEVELS] ?? LEVELS.info;
}

let requestCounter = 0;

/** Generate a short request-scoped correlation ID. */
export function generateRequestId(): string {
  requestCounter = (requestCounter + 1) % 1_000_000;
  const ts = Date.now().toString(36);
  const seq = requestCounter.toString(36).padStart(4, "0");
  return `${ts}-${seq}`;
}

function formatLine(
  route: string,
  level: "info" | "warn" | "error",
  msg: string,
  requestId: string | undefined,
  data?: Record<string, unknown>,
): string {
  const base: Record<string, unknown> = { ts: new Date().toISOString(), route, level, msg };
  if (requestId) base.request_id = requestId;
  return JSON.stringify({ ...base, ...data });
}

export function createLogger(route: string, requestId?: string): Logger {
  const minLevel = getMinLevel();
  return {
    info(msg, data) {
      if (LEVELS.info >= minLevel) console.log(formatLine(route, "info", msg, requestId, data));
    },
    warn(msg, data) {
      if (LEVELS.warn >= minLevel) console.warn(formatLine(route, "warn", msg, requestId, data));
    },
    error(msg, data) {
      if (LEVELS.error >= minLevel) console.error(formatLine(route, "error", msg, requestId, data));
    },
  };
}

export function timer(): { elapsed(): number } {
  const start = performance.now();
  return { elapsed: () => Math.round((performance.now() - start) * 100) / 100 };
}
