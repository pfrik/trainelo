/**
 * Raw Payload Blob Storage
 *
 * Implements the "ALWAYS store raw JSON to blob storage BEFORE parsing" rule.
 * Stores raw JSON payloads from integrations (Garmin, Strava, etc.) to Supabase
 * Storage with idempotent keys based on SHA256 hashes.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

// ============================================================================
// Types
// ============================================================================

export interface PutRawPayloadParams {
  userId: string;
  provider: "garmin" | "manual" | string;
  date: string; // yyyy-mm-dd
  externalId: string;
  payload: Record<string, unknown>;
}

export interface PutRawPayloadResult {
  bucket: string;
  key: string;
  hash: string;
}

interface BlobKeyParams {
  userId: string;
  provider: string;
  date: string;
  externalId: string;
  hash: string;
}

// ============================================================================
// Constants
// ============================================================================

const BUCKET_NAME = "raw-payloads";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a SHA256 hash of the payload for idempotency.
 * Same payload always produces the same hash.
 */
export function generatePayloadHash(payload: Record<string, unknown>): string {
  // Use JSON.stringify with sorted keys for deterministic output
  const canonicalJson = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash("sha256").update(canonicalJson).digest("hex");
}

/**
 * Generate a deterministic blob key for the payload.
 * Format: raw/{provider}/{userId}/{yyyy-mm-dd}/{externalId}_{sha256}.json
 */
export function generateBlobKey(params: BlobKeyParams): string {
  const { userId, provider, date, externalId, hash } = params;

  // Validate date format (yyyy-mm-dd)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid date format: ${date}. Expected yyyy-mm-dd`);
  }

  // Sanitize components to avoid path traversal
  const sanitizedProvider = sanitizePathComponent(provider);
  const sanitizedUserId = sanitizePathComponent(userId);
  const sanitizedExternalId = sanitizePathComponent(externalId);

  return `raw/${sanitizedProvider}/${sanitizedUserId}/${date}/${sanitizedExternalId}_${hash}.json`;
}

/**
 * Sanitize a path component to prevent path traversal attacks.
 * Only allows alphanumeric, hyphens, and underscores.
 */
function sanitizePathComponent(value: string): string {
  // Replace any non-safe characters with underscores
  return value.replace(/[^a-zA-Z0-9\-_]/g, "_");
}

// ============================================================================
// Service Role Client
// ============================================================================

let serviceRoleClient: SupabaseClient | null = null;

/**
 * Get or create a Supabase client with service role privileges.
 * Service role is required for writing to private buckets.
 */
function getServiceRoleClient(): SupabaseClient {
  if (serviceRoleClient) {
    return serviceRoleClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables. " +
        "Service role key is required for blob storage access."
    );
  }

  serviceRoleClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return serviceRoleClient;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Store a raw JSON payload to blob storage.
 *
 * Features:
 * - Deterministic key based on SHA256 hash (same payload = same key)
 * - Idempotent: uploading same payload twice is safe
 * - Uses service role for private bucket access
 *
 * @param params - Parameters including userId, provider, date, externalId, and payload
 * @returns Result with bucket name, key, and hash
 */
export async function putRawPayload(
  params: PutRawPayloadParams
): Promise<PutRawPayloadResult> {
  const { userId, provider, date, externalId, payload } = params;

  // Generate hash for idempotency
  const hash = generatePayloadHash(payload);

  // Generate deterministic key
  const key = generateBlobKey({
    userId,
    provider,
    date,
    externalId,
    hash,
  });

  // Get service role client
  const client = getServiceRoleClient();

  // Convert payload to JSON string
  const jsonContent = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonContent], { type: "application/json" });

  // Upload to storage (upsert: false means it won't fail if already exists)
  const { error } = await client.storage.from(BUCKET_NAME).upload(key, blob, {
    contentType: "application/json",
    upsert: false, // Don't overwrite - same hash means same content anyway
  });

  // Ignore "already exists" errors since this is idempotent
  if (error && !error.message.includes("already exists")) {
    throw new Error(`Failed to upload raw payload: ${error.message}`);
  }

  return {
    bucket: BUCKET_NAME,
    key,
    hash,
  };
}

/**
 * Check if a raw payload already exists in blob storage.
 *
 * @param params - Same parameters as putRawPayload
 * @returns true if the payload exists, false otherwise
 */
export async function rawPayloadExists(
  params: Omit<PutRawPayloadParams, "payload"> & { hash: string }
): Promise<boolean> {
  const { userId, provider, date, externalId, hash } = params;

  const key = generateBlobKey({
    userId,
    provider,
    date,
    externalId,
    hash,
  });

  const client = getServiceRoleClient();

  const { data, error } = await client.storage.from(BUCKET_NAME).list(
    key
      .split("/")
      .slice(0, -1)
      .join("/"), // Get parent directory
    {
      search: key.split("/").pop(), // Search for file name
    }
  );

  if (error) {
    // If bucket doesn't exist or other error, assume not exists
    return false;
  }

  return data.some((file) => key.endsWith(file.name));
}
