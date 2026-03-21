/**
 * POST /api/garmin/trigger
 *
 * Triggers the Garmin sync GitHub Actions workflow via the GitHub API.
 *
 * Authentication: Bearer <CRON_SECRET> (same as daily-recommendations cron)
 *
 * Env vars: GITHUB_PAT, GITHUB_REPO (format: "owner/repo")
 *
 * Response:
 *   { ok: boolean, error?: string }
 */

import { createLogger, generateRequestId } from "../../src/lib/core/observability/log.js";

// ============================================================================
// Helpers
// ============================================================================

function sanitizeEnvValue(value: string | undefined): string | null {
  if (!value) return null;
  const withoutControl = value.replace(/[\u0000-\u001F\u007F]/g, "");
  const trimmed = withoutControl.trim();
  if (!trimmed) return null;
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    const unquoted = trimmed.slice(1, -1).trim();
    return unquoted || null;
  }
  return trimmed;
}

function isAuthorized(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = sanitizeEnvValue(process.env.CRON_SECRET);
  if (!cronSecret) {
    return false;
  }
  return authHeader === `Bearer ${cronSecret}`;
}

// ============================================================================
// Handler (Web API format for Vercel Functions / Cron)
// ============================================================================

export async function POST(request: Request): Promise<Response> {
  const log = createLogger("garmin/trigger", generateRequestId());
  const headers = { "cache-control": "no-store" };

  if (!isAuthorized(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401, headers });
  }

  const githubPat = sanitizeEnvValue(process.env.GITHUB_PAT);
  const githubRepo = sanitizeEnvValue(process.env.GITHUB_REPO);

  if (!githubPat || !githubRepo) {
    log.error("missing GitHub configuration");
    return Response.json(
      { ok: false, error: "Missing GitHub configuration" },
      { status: 500, headers },
    );
  }

  const url = `https://api.github.com/repos/${githubRepo}/actions/workflows/garmin-sync.yml/dispatches`;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubPat}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: "main",
      }),
    });

    if (resp.status === 204) {
      log.info("workflow dispatched");
      return Response.json({ ok: true }, { headers });
    }

    const body = await resp.text();
    log.error("GitHub API error", { status: resp.status, body });
    return Response.json(
      { ok: false, error: `GitHub API returned ${resp.status}` },
      { status: 502, headers },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("dispatch error", { error: msg });
    return Response.json(
      { ok: false, error: msg },
      { status: 500, headers },
    );
  }
}
