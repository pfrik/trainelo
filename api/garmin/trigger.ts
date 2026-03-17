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
    console.warn("[trigger] CRON_SECRET not configured");
    return false;
  }
  return authHeader === `Bearer ${cronSecret}`;
}

// ============================================================================
// Handler (Web API format for Vercel Functions / Cron)
// ============================================================================

export async function POST(request: Request): Promise<Response> {
  const headers = { "cache-control": "no-store" };

  if (!isAuthorized(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401, headers });
  }

  const githubPat = sanitizeEnvValue(process.env.GITHUB_PAT);
  const githubRepo = sanitizeEnvValue(process.env.GITHUB_REPO);

  if (!githubPat || !githubRepo) {
    console.error("[trigger] Missing GITHUB_PAT or GITHUB_REPO");
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
      console.log("[trigger] GitHub Actions workflow dispatched successfully");
      return Response.json({ ok: true }, { headers });
    }

    const body = await resp.text();
    console.error(`[trigger] GitHub API error: ${resp.status} ${body}`);
    return Response.json(
      { ok: false, error: `GitHub API returned ${resp.status}` },
      { status: 502, headers },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[trigger] Dispatch error:", msg);
    return Response.json(
      { ok: false, error: msg },
      { status: 500, headers },
    );
  }
}
