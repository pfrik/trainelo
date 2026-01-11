"""
Supabase client for database operations.
Handles connections and CRUD operations for canonical tables.
"""

from datetime import datetime
from typing import Any, Optional

from supabase import create_client, Client

from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SOURCE


class SupabaseClient:
    """Supabase database client."""

    def __init__(self):
        self.client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    def get_sync_state(self, user_id: str, data_type: str) -> Optional[dict[str, Any]]:
        """
        Get the sync state for a specific data type.

        Args:
            user_id: User ID
            data_type: Type of data (activities, daily_summary, sleep, hrv)

        Returns:
            Sync state record or None if not found
        """
        result = (
            self.client.table("sync_state")
            .select("*")
            .eq("user_id", user_id)
            .eq("provider", SOURCE)
            .eq("data_type", data_type)
            .limit(1)
            .execute()
        )

        return result.data[0] if result.data else None

    def upsert_sync_state(
        self,
        user_id: str,
        data_type: str,
        last_sync_date: str,
        sync_status: str = "success",
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
            sync_status: Status of sync (success, failed, in_progress)
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
            "last_sync_completed_at": now if sync_status == "success" else None,
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

        result = (
            self.client.table("sync_state")
            .upsert(
                data,
                on_conflict="user_id,provider,data_type",
            )
            .execute()
        )

        return result.data[0] if result.data else data

    def upsert_workout(self, workout: dict[str, Any]) -> dict[str, Any]:
        """
        Upsert a workout record.

        Args:
            workout: Workout data

        Returns:
            Upserted record
        """
        result = (
            self.client.table("workouts")
            .upsert(
                workout,
                on_conflict="user_id,source,source_ref",
            )
            .execute()
        )

        return result.data[0] if result.data else workout

    def upsert_daily_metrics(self, metrics: dict[str, Any]) -> dict[str, Any]:
        """
        Upsert a canonical daily metrics record.

        Args:
            metrics: Daily metrics data

        Returns:
            Upserted record
        """
        result = (
            self.client.table("canonical_daily_metrics")
            .upsert(
                metrics,
                on_conflict="user_id,source,date",
            )
            .execute()
        )

        return result.data[0] if result.data else metrics

    def upsert_sleep_session(self, sleep: dict[str, Any]) -> dict[str, Any]:
        """
        Upsert a sleep session record.

        Args:
            sleep: Sleep session data

        Returns:
            Upserted record
        """
        result = (
            self.client.table("sleep_sessions")
            .upsert(
                sleep,
                on_conflict="user_id,source,source_ref",
            )
            .execute()
        )

        return result.data[0] if result.data else sleep

    def upsert_hrv_night(self, hrv: dict[str, Any]) -> dict[str, Any]:
        """
        Upsert an HRV night record.

        Args:
            hrv: HRV data

        Returns:
            Upserted record
        """
        result = (
            self.client.table("hrv_nights")
            .upsert(
                hrv,
                on_conflict="user_id,source,date",
            )
            .execute()
        )

        return result.data[0] if result.data else hrv

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
        result = (
            self.client.table(table)
            .select("id")
            .eq("user_id", user_id)
            .eq("source", SOURCE)
            .eq("source_ref", source_ref)
            .limit(1)
            .execute()
        )

        return len(result.data) > 0
