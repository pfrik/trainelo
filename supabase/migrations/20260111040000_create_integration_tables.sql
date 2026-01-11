-- ============================================================================
-- Migration: Create Integration Management Tables
-- Description: OAuth connections and sync state tracking per provider
-- ============================================================================

-- ============================================================================
-- Table: integration_connections
-- Purpose: OAuth tokens and connection status per provider (Garmin, Strava, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.integration_connections (
    -- Canonical columns
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source TEXT NOT NULL DEFAULT 'system',
    source_ref TEXT,
    schema_version TEXT NOT NULL DEFAULT 'v1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Provider identification
    provider TEXT NOT NULL, -- 'garmin', 'strava', 'wahoo', 'polar', 'apple_health', etc.
    provider_user_id TEXT, -- User's ID in the external system

    -- Connection status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',
        'connected',
        'disconnected',
        'expired',
        'revoked',
        'error'
    )),

    -- OAuth tokens (encrypted at rest via Supabase Vault in production)
    access_token TEXT,
    refresh_token TEXT,
    token_type TEXT DEFAULT 'Bearer',
    access_token_expires_at TIMESTAMPTZ,
    refresh_token_expires_at TIMESTAMPTZ,

    -- OAuth metadata
    scopes TEXT[], -- Array of granted scopes
    oauth_state TEXT, -- For CSRF protection during OAuth flow

    -- Connection metadata
    connected_at TIMESTAMPTZ,
    disconnected_at TIMESTAMPTZ,
    last_successful_sync TIMESTAMPTZ,
    last_error_at TIMESTAMPTZ,
    last_error_message TEXT,
    consecutive_errors INTEGER NOT NULL DEFAULT 0,

    -- Provider-specific profile data
    provider_profile JSONB, -- Name, profile URL, etc. from provider

    -- Sync preferences per provider
    sync_enabled BOOLEAN NOT NULL DEFAULT true,
    sync_workouts BOOLEAN NOT NULL DEFAULT true,
    sync_daily_metrics BOOLEAN NOT NULL DEFAULT true,
    sync_sleep BOOLEAN NOT NULL DEFAULT true,
    sync_hrv BOOLEAN NOT NULL DEFAULT true,
    backfill_days INTEGER DEFAULT 30, -- How far back to sync on initial connect

    -- Webhook configuration (if provider supports push)
    webhook_enabled BOOLEAN NOT NULL DEFAULT false,
    webhook_secret TEXT,
    webhook_url TEXT,

    -- Notes
    notes TEXT,

    -- Extended metadata
    metadata JSONB DEFAULT '{}',

    -- Constraints
    CONSTRAINT integration_connections_unique_provider UNIQUE (user_id, provider)
);

COMMENT ON TABLE public.integration_connections IS 'OAuth connections and status for external fitness providers';
COMMENT ON COLUMN public.integration_connections.provider IS 'Provider ID: garmin, strava, wahoo, polar, apple_health';
COMMENT ON COLUMN public.integration_connections.status IS 'Connection status: pending, connected, disconnected, expired, revoked, error';
COMMENT ON COLUMN public.integration_connections.scopes IS 'Array of OAuth scopes granted by user';
COMMENT ON COLUMN public.integration_connections.consecutive_errors IS 'Count of consecutive sync failures, reset on success';
COMMENT ON COLUMN public.integration_connections.backfill_days IS 'Number of days to sync historically on initial connect';

-- ============================================================================
-- Table: sync_state
-- Purpose: Tracks last sync cursor/timestamp per user per data type per provider
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sync_state (
    -- Canonical columns
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source TEXT NOT NULL DEFAULT 'system',
    source_ref TEXT,
    schema_version TEXT NOT NULL DEFAULT 'v1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Sync identification
    provider TEXT NOT NULL, -- 'garmin', 'strava', etc.
    data_type TEXT NOT NULL, -- 'workouts', 'daily_metrics', 'sleep', 'hrv', etc.

    -- Reference to connection
    connection_id UUID REFERENCES public.integration_connections(id) ON DELETE CASCADE,

    -- Cursor tracking (different providers use different cursor types)
    last_sync_cursor TEXT, -- Generic cursor (could be ID, timestamp string, etc.)
    last_sync_timestamp TIMESTAMPTZ, -- Timestamp-based cursor
    last_sync_date DATE, -- Date-based cursor (for daily data)
    last_sync_id TEXT, -- ID-based cursor (for activity lists)

    -- Sync window
    sync_from_date DATE, -- Earliest date to sync from
    sync_to_date DATE, -- Latest date synced to (usually today)

    -- Sync status
    sync_status TEXT NOT NULL DEFAULT 'idle' CHECK (sync_status IN (
        'idle',
        'syncing',
        'completed',
        'failed',
        'paused'
    )),
    last_sync_started_at TIMESTAMPTZ,
    last_sync_completed_at TIMESTAMPTZ,
    last_sync_duration_ms INTEGER,

    -- Sync results
    last_sync_records_fetched INTEGER,
    last_sync_records_created INTEGER,
    last_sync_records_updated INTEGER,
    last_sync_records_skipped INTEGER,

    -- Error tracking
    last_error_at TIMESTAMPTZ,
    last_error_message TEXT,
    last_error_code TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMPTZ,

    -- Backfill tracking
    backfill_completed BOOLEAN NOT NULL DEFAULT false,
    backfill_started_at TIMESTAMPTZ,
    backfill_completed_at TIMESTAMPTZ,
    backfill_from_date DATE,

    -- Rate limiting
    rate_limit_remaining INTEGER,
    rate_limit_reset_at TIMESTAMPTZ,

    -- Extended metadata
    metadata JSONB DEFAULT '{}',

    -- Constraints
    CONSTRAINT sync_state_unique UNIQUE (user_id, provider, data_type)
);

COMMENT ON TABLE public.sync_state IS 'Tracks sync progress and cursors per user/provider/data_type';
COMMENT ON COLUMN public.sync_state.data_type IS 'Type of data being synced: workouts, daily_metrics, sleep, hrv';
COMMENT ON COLUMN public.sync_state.last_sync_cursor IS 'Provider-specific cursor for incremental sync';
COMMENT ON COLUMN public.sync_state.sync_status IS 'Current sync status: idle, syncing, completed, failed, paused';
COMMENT ON COLUMN public.sync_state.backfill_completed IS 'Whether initial historical backfill is done';
COMMENT ON COLUMN public.sync_state.rate_limit_remaining IS 'API rate limit remaining from last response';
