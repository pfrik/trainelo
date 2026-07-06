/**
 * Shared user resolution for user-facing API endpoints.
 *
 * Verifies a Supabase JWT from the Authorization header and returns the
 * user id. Extracted from api/garmin/sync-status.ts so other endpoints
 * (e.g. api/sync/refresh.ts) authenticate identically.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function cleanEnvValue(v: string | undefined | null): string | null {
  if (v === undefined || v === null) return null;
  const withoutControls = v.replace(/[\u0000-\u001F\u007F]/g, "");
  let cleaned = withoutControls.trim();
  if (!cleaned) return null;
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned || null;
}

function tryParseUrl(u: string): string | null {
  try {
    return new URL(u).toString();
  } catch {
    return null;
  }
}

function inferSupabaseBaseUrlFromJwt(token: string): string | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const seg = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = seg + "=".repeat((4 - (seg.length % 4)) % 4);
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as { iss?: unknown };
    const issuer = typeof payload?.iss === "string" ? payload.iss : null;
    if (!issuer) return null;
    if (issuer.endsWith("/auth/v1")) return issuer.slice(0, -"/auth/v1".length);
    return new URL(issuer).origin;
  } catch {
    return null;
  }
}

let authClient: SupabaseClient | null = null;
let authClientConfig: { url: string; key: string } | null = null;

function getAuthClient(url: string, key: string): SupabaseClient | null {
  if (authClient && authClientConfig?.url === url && authClientConfig?.key === key) {
    return authClient;
  }
  try {
    authClient = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    authClientConfig = { url, key };
    return authClient;
  } catch {
    return null;
  }
}

/** Resolve the Supabase user id from a "Bearer <jwt>" Authorization header. */
export async function resolveUserId(authHeader: string): Promise<string | null> {
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1];

  const inferred = inferSupabaseBaseUrlFromJwt(token);
  let supabaseUrl = inferred ? tryParseUrl(inferred) : null;

  if (!supabaseUrl) {
    for (const env of ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "VITE_SUPABASE_URL"]) {
      const v = cleanEnvValue(process.env[env]);
      if (v) { supabaseUrl = tryParseUrl(v); if (supabaseUrl) break; }
    }
  }
  if (!supabaseUrl) return null;

  const key =
    cleanEnvValue(process.env.SUPABASE_ANON_KEY) ||
    cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    cleanEnvValue(process.env.VITE_SUPABASE_ANON_KEY) ||
    cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!key) return null;

  const client = getAuthClient(supabaseUrl, key);
  if (!client) return null;

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}
