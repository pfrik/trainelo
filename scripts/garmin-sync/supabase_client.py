"""
Supabase client for database operations.
Handles connections and CRUD operations for canonical tables.
Uses httpx for REST API calls instead of the Supabase Python client.
"""

from datetime import datetime
from typing import Any, Optional

import httpx

from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SOURCE


class SupabaseClient:
    """Supabase database client using REST API."""

    def __init__(self):
        self.base_url = f"{SUPABASE_URL}/rest/v1"
        self.headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
        }
        self.client = httpx.Client(headers=self.headers, timeout=30.0)

    def _request(
        self,
        method: str,
        table: str,
        params: dict = None,
        json: Any = None,
        extra_headers: dict = None,
    ) -> httpx.Response:
        """Make a request to the Supabase REST API."""
        url = f"{self.base_url}/{table}"
        headers = {**self.headers, **(extra_headers or {})}
        response = self.client.request(method, url, params=params, json=json, headers=headers)

        # Log detailed error info for 4xx errors
        if response.status_code >= 400:
            print(f"\n[Supabase Error] {method} {table}")
            print(f"  Status: {response.status_code}")
            print(f"  Response: {response.text}")
            if json:
                # Print the data keys being sent (not values to avoid PII)
                print(f"  Data keys: {list(json.keys()) if isinstance(json, dict) else 'N/A'}")

        response.raise_for_status()
        return response

    def get_sync_state(self, user_id: str, data_type: str) -> Optional[dict[str, Any]]:
        """
        Get the sync state for a specific data type.

        Args:
            user_id: User ID
            data_type: Type of data (activities, daily_summary, sleep, hrv)

        Returns:
            Sync state record or None if not found
        """
        params = {
            "select": "*",
            "user_id": f"eq.{user_id}",
            "provider": f"eq.{SOURCE}",
            "data_type": f"eq.{data_type}",
            "limit": "1",
        }
        response = self._request("GET", "sync_state", params=params)
        data = response.json()
        return data[0] if data else None

    def upsert_sync_state(
        self,
        user_id: str,
        data_type: str,
        last_sync_date: str,
        sync_status: str = "completed",
        records_fetched: int = 0,
        records_created: int = 0,
        records_updated: int = 0,
        records_skipped: int = 0,
        error_message: str = None,
        sync_duration_ms: int = None,
    ) -> dict[str, Any]:
        """
        Update or insert sync state.

        Args:
            user_id: User ID
            data_type: Type of data
            last_sync_date: Date of last sync (ISO format)
            sync_status: Status of sync (completed, failed, syncing, idle, paused)
            records_fetched: Number of records fetched
            records_created: Number of new records created
            records_updated: Number of records updated
            records_skipped: Number of records skipped
            error_message: Error message if failed
            sync_duration_ms: Duration of sync in milliseconds

        Returns:
            Updated sync state record
        """
        now = datetime.utcnow().isoformat()

        data = {
            "user_id": user_id,
            "provider": SOURCE,
            "source": SOURCE,
            "data_type": data_type,
            "last_sync_date": last_sync_date,
            "last_sync_timestamp": now,
            "last_sync_completed_at": now if sync_status == "completed" else None,
            "sync_status": sync_status,
            "last_sync_records_fetched": records_fetched,
            "last_sync_records_created": records_created,
            "last_sync_records_updated": records_updated,
            "last_sync_records_skipped": records_skipped,
            "last_sync_duration_ms": sync_duration_ms,
            "updated_at": now,
            "schema_version": "1.0",
        }

        if error_message:
            data["last_error_message"] = error_message
            data["last_error_at"] = now

        extra_headers = {
            "Prefer": "resolution=merge-duplicates,return=representation",
        }
        params = {"on_conflict": "user_id,provider,data_type"}
        response = self._request("POST", "sync_state", params=params, json=data, extra_headers=extra_headers)
        result = response.json()
        return result[0] if result else data

    def upsert_workout(self, workout: dict[str, Any]) -> dict[str, Any]:
        """
        Upsert a workout record.

        Note: workouts uses a partial unique index which PostgREST can't use
        for ON CONFLICT. We check if record exists first, then update or insert.

        Args:
            workout: Workout data

        Returns:
            Upserted record
        """
        user_id = workout["user_id"]
        source_ref = workout["source_ref"]

        # Check if record exists
        if self.check_record_exists("workouts", user_id, source_ref):
            # Update existing record
            params = {
                "user_id": f"eq.{user_id}",
                "source": f"eq.{SOURCE}",
                "source_ref": f"eq.{source_ref}",
            }
            extra_headers = {"Prefer": "return=representation"}
            response = self._request("PATCH", "workouts", params=params, json=workout, extra_headers=extra_headers)
        else:
            # Insert new record
            extra_headers = {"Prefer": "return=representation"}
            response = self._request("POST", "workouts", json=workout, extra_headers=extra_headers)

        result = response.json()
        return result[0] if result else workout

    def upsert_daily_metrics(self, metrics: dict[str, Any]) -> dict[str, Any]:
        """
        Upsert a canonical daily metrics record.

        Args:
            metrics: Daily metrics data

        Returns:
            Upserted record
        """
        extra_headers = {
            "Prefer": "resolution=merge-duplicates,return=representation",
        }
        params = {"on_conflict": "user_id,date,source"}
        response = self._request("POST", "canonical_daily_metrics", params=params, json=metrics, extra_headers=extra_headers)
        result = response.json()
        return result[0] if result else metrics

    def upsert_sleep_session(self, sleep: dict[str, Any]) -> dict[str, Any]:
        """
        Upsert a sleep session record.

        Note: sleep_sessions uses a partial unique index which PostgREST can't use
        for ON CONFLICT. We check if record exists first, then update or insert.

        Args:
            sleep: Sleep session data

        Returns:
            Upserted record
        """
        user_id = sleep["user_id"]
        source_ref = sleep["source_ref"]

        # Check if record exists
        if self.check_record_exists("sleep_sessions", user_id, source_ref):
            # Update existing record
            params = {
                "user_id": f"eq.{user_id}",
                "source": f"eq.{SOURCE}",
                "source_ref": f"eq.{source_ref}",
            }
            extra_headers = {"Prefer": "return=representation"}
            response = self._request("PATCH", "sleep_sessions", params=params, json=sleep, extra_headers=extra_headers)
        else:
            # Insert new record
            extra_headers = {"Prefer": "return=representation"}
            response = self._request("POST", "sleep_sessions", json=sleep, extra_headers=extra_headers)

        result = response.json()
        return result[0] if result else sleep

    def upsert_hrv_night(self, hrv: dict[str, Any]) -> dict[str, Any]:
        """
        Upsert an HRV night record.

        Args:
            hrv: HRV data

        Returns:
            Upserted record
        """
        extra_headers = {
            "Prefer": "resolution=merge-duplicates,return=representation",
        }
        params = {"on_conflict": "user_id,date,source"}
        response = self._request("POST", "hrv_nights", params=params, json=hrv, extra_headers=extra_headers)
        result = response.json()
        return result[0] if result else hrv

    def upsert_daily_metrics_mvp(self, data: dict[str, Any]) -> dict[str, Any]:
        """
        Upsert a record into the MVP daily_metrics table.

        This table has a UNIQUE(user_id, date) constraint and stores
        aggregated daily values (hrv_ms, resting_heart_rate, sleep_hours,
        sleep_quality) that come from different sync data types.

        Only non-None fields in *data* are sent so that concurrent upserts
        from different sync types don't overwrite each other's columns.

        Args:
            data: Dict with user_id, date, and whichever metric columns apply.

        Returns:
            Upserted record
        """
        # Strip None values so PostgREST only touches columns we have data for
        payload = {k: v for k, v in data.items() if v is not None}
        # user_id and date are always required
        payload["user_id"] = data["user_id"]
        payload["date"] = data["date"]

        extra_headers = {
            "Prefer": "resolution=merge-duplicates,return=representation",
        }
        params = {"on_conflict": "user_id,date"}
        response = self._request(
            "POST", "daily_metrics", params=params, json=payload, extra_headers=extra_headers
        )
        result = response.json()
        return result[0] if result else payload

    def check_record_exists(
        self, table: str, user_id: str, source_ref: str
    ) -> bool:
        """
        Check if a record already exists.

        Args:
            table: Table name
            user_id: User ID
            source_ref: Source reference ID

        Returns:
            True if record exists
        """
        params = {
            "select": "id",
            "user_id": f"eq.{user_id}",
            "source": f"eq.{SOURCE}",
            "source_ref": f"eq.{source_ref}",
            "limit": "1",
        }
        response = self._request("GET", table, params=params)
        data = response.json()
        return len(data) > 0
