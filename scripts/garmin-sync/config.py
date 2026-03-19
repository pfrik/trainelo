"""
Configuration for Garmin sync script.
Loads environment variables and provides configuration constants.
"""

import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Garmin credentials
GARMIN_EMAIL = os.getenv("GARMIN_EMAIL")
GARMIN_PASSWORD = os.getenv("GARMIN_PASSWORD")

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# User configuration
TRAINELO_USER_ID = os.getenv("TRAINELO_USER_ID")

# Blob storage configuration
# Set to "true" to skip blob storage (useful for local dev without storage service)
SKIP_BLOB_STORAGE = os.getenv("SKIP_BLOB_STORAGE", "").lower() == "true"

# Sync configuration
DEFAULT_LOOKBACK_DAYS = 7  # Days to look back for incremental sync
FULL_SYNC_LOOKBACK_DAYS = 365  # Days to look back for full sync

# Schema version for tracking data format changes
SCHEMA_VERSION = "1.0"

# Source identifier
SOURCE = "garmin"

# Data types we sync
DATA_TYPES = ["activities", "daily_summary", "sleep", "hrv"]

# Rate limiting
RATE_LIMIT_DELAY_SECONDS = 1  # Delay between API calls to avoid rate limiting

# Authentication retry (Garmin SSO aggressively 429s cloud IPs)
AUTH_MAX_RETRIES = 3
AUTH_INITIAL_BACKOFF_SECONDS = 30  # Doubles each attempt: 30s, 60s, 120s


def validate_config():
    """Validate that all required configuration is present."""
    missing = []

    if not GARMIN_EMAIL:
        missing.append("GARMIN_EMAIL")
    if not GARMIN_PASSWORD:
        missing.append("GARMIN_PASSWORD")
    if not SUPABASE_URL:
        missing.append("SUPABASE_URL")
    if not SUPABASE_SERVICE_ROLE_KEY:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")
    if not TRAINELO_USER_ID:
        missing.append("TRAINELO_USER_ID")

    if missing:
        raise ValueError(f"Missing required environment variables: {', '.join(missing)}")

    return True
