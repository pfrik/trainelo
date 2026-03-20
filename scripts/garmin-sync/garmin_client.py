"""
Garmin Connect API client wrapper.
Handles authentication and data fetching from Garmin Connect.

Supports OAuth token caching via garth to avoid repeated logins
and Garmin's aggressive rate-limiting on cloud IPs.
"""

import base64
import json
import os
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Optional

from garminconnect import Garmin, GarminConnectAuthenticationError

from config import (
    GARMIN_EMAIL,
    GARMIN_PASSWORD,
    RATE_LIMIT_DELAY_SECONDS,
    AUTH_MAX_RETRIES,
    AUTH_INITIAL_BACKOFF_SECONDS,
)

# Default token directory (next to this script)
_DEFAULT_TOKEN_DIR = Path(__file__).parent / ".garmin_tokens"


class GarminClient:
    """Wrapper around python-garminconnect library."""

    def __init__(self, email: str = None, password: str = None, token_dir: str | Path | None = None):
        self.email = email or GARMIN_EMAIL
        self.password = password or GARMIN_PASSWORD
        self.client: Optional[Garmin] = None
        self._last_request_time: float = 0
        self.token_dir = Path(token_dir) if token_dir else _DEFAULT_TOKEN_DIR

    def _rate_limit(self):
        """Ensure we don't make requests too quickly."""
        elapsed = time.time() - self._last_request_time
        if elapsed < RATE_LIMIT_DELAY_SECONDS:
            time.sleep(RATE_LIMIT_DELAY_SECONDS - elapsed)
        self._last_request_time = time.time()

    def _is_rate_limit_error(self, error: Exception) -> bool:
        """Check if an exception is caused by Garmin 429 rate limiting."""
        error_str = str(error).lower()
        return "429" in error_str or "too many" in error_str or "max retries" in error_str

    def authenticate(self) -> bool:
        """
        Authenticate with Garmin Connect.

        Tries to resume from cached OAuth tokens first. Falls back to
        full email/password login if tokens are missing or expired.
        Retries with exponential backoff on 429 rate-limit errors.
        Saves tokens after successful authentication for next run.

        Returns:
            True if authentication successful

        Raises:
            GarminConnectAuthenticationError: If authentication fails
            Exception: If all retry attempts are exhausted
        """
        last_error: Exception | None = None

        for attempt in range(1, AUTH_MAX_RETRIES + 1):
            try:
                return self._try_authenticate()
            except GarminConnectAuthenticationError:
                # Bad credentials — don't retry
                raise
            except Exception as e:
                last_error = e
                if not self._is_rate_limit_error(e):
                    # Non-rate-limit error — don't retry
                    raise

                if attempt < AUTH_MAX_RETRIES:
                    backoff = AUTH_INITIAL_BACKOFF_SECONDS * (2 ** (attempt - 1))
                    print(f"⏳ Rate limited by Garmin (attempt {attempt}/{AUTH_MAX_RETRIES}). "
                          f"Waiting {backoff}s before retry...")
                    time.sleep(backoff)
                    self.client = None
                else:
                    print(f"❌ All {AUTH_MAX_RETRIES} authentication attempts failed (429 rate limit)")

        raise last_error

    def _restore_tokens_from_env(self) -> bool:
        """
        Restore OAuth tokens from GARMIN_TOKENS_BASE64 env var.
        Returns True if tokens were written to disk.
        """
        encoded = os.environ.get("GARMIN_TOKENS_BASE64")
        if not encoded:
            return False

        try:
            bundle = json.loads(base64.b64decode(encoded))
            self.token_dir.mkdir(parents=True, exist_ok=True)
            (self.token_dir / "oauth1_token.json").write_text(
                json.dumps(bundle["oauth1"])
            )
            (self.token_dir / "oauth2_token.json").write_text(
                json.dumps(bundle["oauth2"])
            )
            print("Restored OAuth tokens from GARMIN_TOKENS_BASE64 secret")
            return True
        except Exception as e:
            print(f"Warning: Failed to restore tokens from env: {e}")
            return False

    def _try_authenticate(self) -> bool:
        """Single authentication attempt (env secret → cached tokens → full login)."""
        # Always prefer tokens from GARMIN_TOKENS_BASE64 when set —
        # the env secret is fresher than stale tokens restored from Actions cache.
        if os.environ.get("GARMIN_TOKENS_BASE64"):
            self._restore_tokens_from_env()
        elif not self.token_dir.exists():
            self._restore_tokens_from_env()

        # Try token-based resume
        if self.token_dir.exists():
            try:
                self.client = Garmin()
                self.client.login(str(self.token_dir))
                print(f"Resumed session from cached tokens")
                self._save_tokens()
                return True
            except GarminConnectAuthenticationError:
                # Bad token + bad credentials — bubble up immediately
                raise
            except Exception as e:
                if self._is_rate_limit_error(e):
                    # Don't fall through to full login — it will also 429
                    raise
                print(f"Token resume failed ({e}), falling back to login...")
                self.client = None

        # Full login with credentials
        self.client = Garmin(self.email, self.password)
        self.client.login()
        print(f"Successfully authenticated as {self.email}")
        self._save_tokens()
        return True

    def _save_tokens(self):
        """Save garth OAuth tokens to disk for reuse."""
        try:
            self.token_dir.mkdir(parents=True, exist_ok=True)
            self.client.garth.dump(str(self.token_dir))
            print(f"Saved OAuth tokens to {self.token_dir}")
        except Exception as e:
            print(f"Warning: Could not save tokens: {e}")

    def get_activities(
        self, start_date: date, end_date: date = None
    ) -> list[dict[str, Any]]:
        """
        Fetch activities from Garmin Connect.

        Args:
            start_date: Start date for activity search
            end_date: End date for activity search (defaults to today)

        Returns:
            List of activity dictionaries
        """
        if not self.client:
            raise RuntimeError("Not authenticated. Call authenticate() first.")

        end_date = end_date or date.today()

        self._rate_limit()

        # Get activities list
        activities = self.client.get_activities_by_date(
            start_date.isoformat(),
            end_date.isoformat()
        )

        # Fetch full details for each activity
        detailed_activities = []
        for activity in activities:
            activity_id = activity.get("activityId")
            if activity_id:
                self._rate_limit()
                try:
                    details = self.client.get_activity(activity_id)
                    detailed_activities.append(details)
                except Exception as e:
                    print(f"Warning: Could not fetch details for activity {activity_id}: {e}")
                    detailed_activities.append(activity)

        return detailed_activities

    def get_daily_summary(self, target_date: date) -> dict[str, Any]:
        """
        Fetch daily summary metrics for a specific date.

        Args:
            target_date: Date to fetch summary for

        Returns:
            Daily summary dictionary
        """
        if not self.client:
            raise RuntimeError("Not authenticated. Call authenticate() first.")

        self._rate_limit()

        return self.client.get_stats(target_date.isoformat())

    def get_daily_summaries(
        self, start_date: date, end_date: date = None
    ) -> list[dict[str, Any]]:
        """
        Fetch daily summaries for a date range.

        Args:
            start_date: Start date
            end_date: End date (defaults to today)

        Returns:
            List of daily summary dictionaries
        """
        end_date = end_date or date.today()
        summaries = []

        current = start_date
        while current <= end_date:
            try:
                summary = self.get_daily_summary(current)
                if summary:
                    summary["calendarDate"] = current.isoformat()
                    summaries.append(summary)
            except Exception as e:
                print(f"Warning: Could not fetch daily summary for {current}: {e}")
            current += timedelta(days=1)

        return summaries

    def get_sleep_data(self, target_date: date) -> dict[str, Any]:
        """
        Fetch sleep data for a specific date.

        Args:
            target_date: Date to fetch sleep data for

        Returns:
            Sleep data dictionary
        """
        if not self.client:
            raise RuntimeError("Not authenticated. Call authenticate() first.")

        self._rate_limit()

        return self.client.get_sleep_data(target_date.isoformat())

    def get_sleep_data_range(
        self, start_date: date, end_date: date = None
    ) -> list[dict[str, Any]]:
        """
        Fetch sleep data for a date range.

        Args:
            start_date: Start date
            end_date: End date (defaults to today)

        Returns:
            List of sleep data dictionaries
        """
        end_date = end_date or date.today()
        sleep_records = []

        current = start_date
        while current <= end_date:
            try:
                sleep = self.get_sleep_data(current)
                if sleep and sleep.get("dailySleepDTO"):
                    sleep["requestDate"] = current.isoformat()
                    sleep_records.append(sleep)
            except Exception as e:
                print(f"Warning: Could not fetch sleep data for {current}: {e}")
            current += timedelta(days=1)

        return sleep_records

    def get_hrv_data(self, target_date: date) -> dict[str, Any]:
        """
        Fetch HRV data for a specific date.

        Args:
            target_date: Date to fetch HRV data for

        Returns:
            HRV data dictionary
        """
        if not self.client:
            raise RuntimeError("Not authenticated. Call authenticate() first.")

        self._rate_limit()

        return self.client.get_hrv_data(target_date.isoformat())

    def get_hrv_data_range(
        self, start_date: date, end_date: date = None
    ) -> list[dict[str, Any]]:
        """
        Fetch HRV data for a date range.

        Args:
            start_date: Start date
            end_date: End date (defaults to today)

        Returns:
            List of HRV data dictionaries
        """
        end_date = end_date or date.today()
        hrv_records = []

        current = start_date
        while current <= end_date:
            try:
                hrv = self.get_hrv_data(current)
                if hrv and hrv.get("hrvSummary"):
                    hrv["requestDate"] = current.isoformat()
                    hrv_records.append(hrv)
            except Exception as e:
                print(f"Warning: Could not fetch HRV data for {current}: {e}")
            current += timedelta(days=1)

        return hrv_records

    def get_user_profile(self) -> dict[str, Any]:
        """
        Fetch user profile information.

        Returns:
            User profile dictionary
        """
        if not self.client:
            raise RuntimeError("Not authenticated. Call authenticate() first.")

        self._rate_limit()

        return self.client.get_full_name()
