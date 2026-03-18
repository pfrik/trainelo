"""
Garmin Connect API client wrapper.
Handles authentication and data fetching from Garmin Connect.

Supports OAuth token caching via garth to avoid repeated logins
and Garmin's aggressive rate-limiting on cloud IPs.
"""

import os
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Optional

from garminconnect import Garmin, GarminConnectAuthenticationError

from config import GARMIN_EMAIL, GARMIN_PASSWORD, RATE_LIMIT_DELAY_SECONDS

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

    def authenticate(self) -> bool:
        """
        Authenticate with Garmin Connect.

        Tries to resume from cached OAuth tokens first. Falls back to
        full email/password login if tokens are missing or expired.
        Saves tokens after successful authentication for next run.

        Returns:
            True if authentication successful

        Raises:
            GarminConnectAuthenticationError: If authentication fails
        """
        # Try token-based resume first
        if self.token_dir.exists():
            try:
                self.client = Garmin()
                self.client.login(str(self.token_dir))
                print(f"Resumed session from cached tokens")
                self._save_tokens()
                return True
            except Exception as e:
                print(f"Token resume failed ({e}), falling back to login...")
                self.client = None

        # Full login with credentials
        try:
            self.client = Garmin(self.email, self.password)
            self.client.login()
            print(f"Successfully authenticated as {self.email}")
            self._save_tokens()
            return True
        except GarminConnectAuthenticationError as e:
            print(f"Authentication failed: {e}")
            raise

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
