-- ============================================================================
-- Migration: Create Raw Payloads Storage Bucket
-- Description: Private bucket for storing raw JSON payloads from integrations
-- ============================================================================

-- Create the storage bucket for raw payloads
-- Note: This uses Supabase's storage.buckets table
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'raw-payloads',
    'raw-payloads',
    false, -- Private bucket (service role only)
    5242880, -- 5MB max file size
    ARRAY['application/json']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Note: RLS policies for this bucket should be added separately.
-- For now, only service role can access this bucket (default for private buckets).
--
-- The bucket is used to store raw JSON payloads from external integrations
-- (Garmin, Strava, etc.) BEFORE parsing. This ensures:
-- 1. Original data is preserved for debugging/reprocessing
-- 2. Schema changes don't lose historical data
-- 3. Idempotent imports (same payload = same key via SHA256 hash)
--
-- Key format: raw/{provider}/{userId}/{yyyy-mm-dd}/{externalId}_{sha256}.json
