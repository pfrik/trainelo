/**
 * GET /api/ping
 *
 * Simple health check endpoint to verify Vercel Functions are working.
 */
export function GET() {
  return Response.json(
    { ok: true, now: new Date().toISOString() },
    { headers: { "cache-control": "no-store" } }
  );
}
