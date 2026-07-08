/**
 * Dead-man's-switch pings for cron jobs (healthchecks.io-style).
 *
 * Each cron pings its check URL on completion — the success URL when the run
 * was clean, `<url>/fail` otherwise. If the cron stops running entirely, the
 * check times out server-side and alerts anyway (that's the dead-man's
 * switch). Unset env var = feature off; a ping failure is never fatal.
 */

import { cleanEnvValue } from "./resolveUser.js";

const PING_TIMEOUT_MS = 5000;

export async function pingHealthcheck(
  rawUrl: string | undefined | null,
  ok: boolean,
): Promise<void> {
  const url = cleanEnvValue(rawUrl);
  if (!url) return;

  try {
    await fetch(ok ? url : `${url}/fail`, {
      method: "POST",
      signal: AbortSignal.timeout(PING_TIMEOUT_MS),
    });
  } catch {
    // Never let monitoring break the job it monitors.
  }
}
