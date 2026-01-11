"""
Garmin Connect API client wrapper.
Handles authentication and data fetching from Garmin Connect.
"""

import time
from datetime import date, datetime, timedelta
from typing import Any, Optional

from garminconnect import Garmin, GarminConnectAuthenticationError

from config import GARMIN_EMAIL, GARMIN_PASSWORD, RATE_LIMIT_DELAY_SECONDS


class GarminClient:
    """Wrapper around python-garminconnect library."""

    def __init__(self, email: str = None, password: str = None):
        self.email = email or GARMIN_EMAIL
        self.password = password or GARMIN_PASSWORD
        self.client: Optional[Garmin] = None
        self._last_request_time: float = 0

    def _rate_limit(self):
        """Ensure we don't make requests too quickly."""
        elapsed = time.time() - self._last_request_time
        if elapsed < RATE_LIMIT_DELAY_SECONDS:
            time.sleep(RATE_LIMIT_DELAY_SECONDS - elapsed)
        self._last_request_time = time.time()

    def authenticate(self) -> bool:
        """
        Authenticate with Garmin Connect.

        Note: If MFA is enabled on the account, you may need to:
        1. First run may require entering MFA code interactively
        2. The library will cache the session token for subsequent runs

        Returns:
            True if authentication successful

        Raises:
            GarminConnectAuthenticationError: If authentication fails
        """
        try:
            self.client = Garmin(self.email, self.password)
            self.client.login()
            print(f"Successfully authenticated as {self.email}")
            return True
        except GarminConnectAuthenticationError as e:
            print(f"Authentication failed: {e}")
            raise

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
