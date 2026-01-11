#!/usr/bin/env python3
"""
Garmin Connect data sync script.
Fetches data from Garmin and syncs to Supabase.

Usage:
    python sync.py                    # Incremental sync (last 7 days)
    python sync.py --full             # Full sync (last 365 days)
    python sync.py --dry-run          # Print what would be synced without writing
    python sync.py --days 30          # Sync last 30 days
    python sync.py --type activities  # Sync only activities
"""

import argparse
import sys
import time
from datetime import date, datetime, timedelta
from typing import Any

from config import (
    validate_config,
    TRAINELO_USER_ID,
    DEFAULT_LOOKBACK_DAYS,
    FULL_SYNC_LOOKBACK_DAYS,
    DATA_TYPES,
)
from garmin_client import GarminClient
from supabase_client import SupabaseClient
from blob_storage import BlobStorage
from transformers import (
    transform_activity,
    transform_daily_summary,
    transform_sleep,
    transform_hrv,
)
from transformers.activities import get_activity_date
from transformers.daily_summary import get_daily_summary_date
from transformers.sleep import get_sleep_date, get_sleep_id
from transformers.hrv import get_hrv_date, get_hrv_id


class GarminSync:
    """Main sync orchestrator."""

    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.garmin = GarminClient()
        self.supabase = SupabaseClient() if not dry_run else None
        self.blob_storage = BlobStorage() if not dry_run else None
        self.user_id = TRAINELO_USER_ID

    def _get_last_sync_date(self, data_type: str) -> date:
        """Get the last sync date for a data type."""
        if self.dry_run or not self.supabase:
            return date.today() - timedelta(days=DEFAULT_LOOKBACK_DAYS)

        sync_state = self.supabase.get_sync_state(self.user_id, data_type)

        if sync_state and sync_state.get("last_sync_date"):
            try:
                return date.fromisoformat(sync_state["last_sync_date"])
            except ValueError:
                pass

        return date.today() - timedelta(days=DEFAULT_LOOKBACK_DAYS)

    def _store_raw_payload(
        self, data_type: str, target_date: date, external_id: str, data: dict
    ) -> str:
        """Store raw payload to blob storage."""
        if self.dry_run or not self.blob_storage:
            return f"(dry-run) raw/garmin/{self.user_id}/{target_date}/{data_type}_{external_id}.json"

        return self.blob_storage.store_raw_payload(
            user_id=self.user_id,
            data_type=data_type,
            target_date=target_date,
            external_id=external_id,
            data=data,
        )

    def _update_sync_state(
        self,
        data_type: str,
        last_sync_date: date,
        records_fetched: int,
        records_created: int,
        records_updated: int,
        records_skipped: int,
        sync_duration_ms: int,
        error: str = None,
    ):
        """Update sync state after sync completes."""
        if self.dry_run or not self.supabase:
            return

        self.supabase.upsert_sync_state(
            user_id=self.user_id,
            data_type=data_type,
            last_sync_date=last_sync_date.isoformat(),
            sync_status="failed" if error else "success",
            records_fetched=records_fetched,
            records_created=records_created,
            records_updated=records_updated,
            records_skipped=records_skipped,
            sync_duration_ms=sync_duration_ms,
            error_message=error,
        )

    def sync_activities(self, start_date: date, end_date: date) -> dict[str, int]:
        """Sync activities from Garmin."""
        print(f"\n📊 Syncing activities from {start_date} to {end_date}...")

        start_time = time.time()
        stats = {"fetched": 0, "created": 0, "updated": 0, "skipped": 0}

        try:
            activities = self.garmin.get_activities(start_date, end_date)
            stats["fetched"] = len(activities)
            print(f"   Found {len(activities)} activities")

            for activity in activities:
                activity_id = activity.get("activityId")
                activity_date = date.fromisoformat(get_activity_date(activity))

                # Store raw payload
                blob_key = self._store_raw_payload(
                    "activities", activity_date, str(activity_id), activity
                )
                print(f"   📦 Stored: {blob_key}")

                # Transform to canonical format
                try:
                    canonical = transform_activity(activity, self.user_id)
                except Exception as e:
                    print(f"   ⚠️  Failed to transform activity {activity_id}: {e}")
                    stats["skipped"] += 1
                    continue

                if self.dry_run:
                    print(f"   🏃 Would upsert activity: {canonical.get('title')} ({canonical.get('activity_type')})")
                    stats["created"] += 1
                else:
                    # Check if exists
                    exists = self.supabase.check_record_exists(
                        "workouts", self.user_id, str(activity_id)
                    )

                    self.supabase.upsert_workout(canonical)

                    if exists:
                        stats["updated"] += 1
                        print(f"   🔄 Updated: {canonical.get('title')}")
                    else:
                        stats["created"] += 1
                        print(f"   ✅ Created: {canonical.get('title')}")

        except Exception as e:
            print(f"   ❌ Error syncing activities: {e}")
            self._update_sync_state(
                "activities", end_date, stats["fetched"], stats["created"],
                stats["updated"], stats["skipped"],
                int((time.time() - start_time) * 1000), str(e)
            )
            raise

        self._update_sync_state(
            "activities", end_date, stats["fetched"], stats["created"],
            stats["updated"], stats["skipped"],
            int((time.time() - start_time) * 1000)
        )

        return stats

    def sync_daily_summaries(self, start_date: date, end_date: date) -> dict[str, int]:
        """Sync daily summaries from Garmin."""
        print(f"\n📈 Syncing daily summaries from {start_date} to {end_date}...")

        start_time = time.time()
        stats = {"fetched": 0, "created": 0, "updated": 0, "skipped": 0}

        try:
            summaries = self.garmin.get_daily_summaries(start_date, end_date)
            stats["fetched"] = len(summaries)
            print(f"   Found {len(summaries)} daily summaries")

            for summary in summaries:
                summary_date = get_daily_summary_date(summary)
                if not summary_date:
                    stats["skipped"] += 1
                    continue

                # Store raw payload
                blob_key = self._store_raw_payload(
                    "daily_summary", date.fromisoformat(summary_date),
                    f"daily_{summary_date}", summary
                )
                print(f"   📦 Stored: {blob_key}")

                # Transform to canonical format
                try:
                    canonical = transform_daily_summary(summary, self.user_id)
                except Exception as e:
                    print(f"   ⚠️  Failed to transform daily summary {summary_date}: {e}")
                    stats["skipped"] += 1
                    continue

                if self.dry_run:
                    print(f"   📅 Would upsert daily summary: {summary_date}")
                    stats["created"] += 1
                else:
                    self.supabase.upsert_daily_metrics(canonical)
                    stats["created"] += 1
                    print(f"   ✅ Synced: {summary_date} (steps: {canonical.get('steps')})")

        except Exception as e:
            print(f"   ❌ Error syncing daily summaries: {e}")
            self._update_sync_state(
                "daily_summary", end_date, stats["fetched"], stats["created"],
                stats["updated"], stats["skipped"],
                int((time.time() - start_time) * 1000), str(e)
            )
            raise

        self._update_sync_state(
            "daily_summary", end_date, stats["fetched"], stats["created"],
            stats["updated"], stats["skipped"],
            int((time.time() - start_time) * 1000)
        )

        return stats

    def sync_sleep(self, start_date: date, end_date: date) -> dict[str, int]:
        """Sync sleep data from Garmin."""
        print(f"\n😴 Syncing sleep data from {start_date} to {end_date}...")

        start_time = time.time()
        stats = {"fetched": 0, "created": 0, "updated": 0, "skipped": 0}

        try:
            sleep_records = self.garmin.get_sleep_data_range(start_date, end_date)
            stats["fetched"] = len(sleep_records)
            print(f"   Found {len(sleep_records)} sleep records")

            for sleep in sleep_records:
                sleep_date = get_sleep_date(sleep)
                sleep_id = get_sleep_id(sleep)

                if not sleep_date:
                    stats["skipped"] += 1
                    continue

                # Store raw payload
                blob_key = self._store_raw_payload(
                    "sleep", date.fromisoformat(sleep_date), sleep_id, sleep
                )
                print(f"   📦 Stored: {blob_key}")

                # Transform to canonical format
                try:
                    canonical = transform_sleep(sleep, self.user_id)
                except Exception as e:
                    print(f"   ⚠️  Failed to transform sleep {sleep_date}: {e}")
                    stats["skipped"] += 1
                    continue

                if self.dry_run:
                    duration_hrs = (canonical.get("duration_seconds") or 0) / 3600
                    print(f"   🛏️  Would upsert sleep: {sleep_date} ({duration_hrs:.1f}h)")
                    stats["created"] += 1
                else:
                    self.supabase.upsert_sleep_session(canonical)
                    duration_hrs = (canonical.get("duration_seconds") or 0) / 3600
                    stats["created"] += 1
                    print(f"   ✅ Synced: {sleep_date} ({duration_hrs:.1f}h, score: {canonical.get('sleep_score')})")

        except Exception as e:
            print(f"   ❌ Error syncing sleep: {e}")
            self._update_sync_state(
                "sleep", end_date, stats["fetched"], stats["created"],
                stats["updated"], stats["skipped"],
                int((time.time() - start_time) * 1000), str(e)
            )
            raise

        self._update_sync_state(
            "sleep", end_date, stats["fetched"], stats["created"],
            stats["updated"], stats["skipped"],
            int((time.time() - start_time) * 1000)
        )

        return stats

    def sync_hrv(self, start_date: date, end_date: date) -> dict[str, int]:
        """Sync HRV data from Garmin."""
        print(f"\n💓 Syncing HRV data from {start_date} to {end_date}...")

        start_time = time.time()
        stats = {"fetched": 0, "created": 0, "updated": 0, "skipped": 0}

        try:
            hrv_records = self.garmin.get_hrv_data_range(start_date, end_date)
            stats["fetched"] = len(hrv_records)
            print(f"   Found {len(hrv_records)} HRV records")

            for hrv in hrv_records:
                hrv_date = get_hrv_date(hrv)
                hrv_id = get_hrv_id(hrv)

                if not hrv_date:
                    stats["skipped"] += 1
                    continue

                # Store raw payload
                blob_key = self._store_raw_payload(
                    "hrv", date.fromisoformat(hrv_date), hrv_id, hrv
                )
                print(f"   📦 Stored: {blob_key}")

                # Transform to canonical format
                try:
                    canonical = transform_hrv(hrv, self.user_id)
                except Exception as e:
                    print(f"   ⚠️  Failed to transform HRV {hrv_date}: {e}")
                    stats["skipped"] += 1
                    continue

                if self.dry_run:
                    print(f"   💗 Would upsert HRV: {hrv_date} (rmssd: {canonical.get('hrv_rmssd')}ms)")
                    stats["created"] += 1
                else:
                    self.supabase.upsert_hrv_night(canonical)
                    stats["created"] += 1
                    print(f"   ✅ Synced: {hrv_date} (rmssd: {canonical.get('hrv_rmssd')}ms, status: {canonical.get('hrv_status')})")

        except Exception as e:
            print(f"   ❌ Error syncing HRV: {e}")
            self._update_sync_state(
                "hrv", end_date, stats["fetched"], stats["created"],
                stats["updated"], stats["skipped"],
                int((time.time() - start_time) * 1000), str(e)
            )
            raise

        self._update_sync_state(
            "hrv", end_date, stats["fetched"], stats["created"],
            stats["updated"], stats["skipped"],
            int((time.time() - start_time) * 1000)
        )

        return stats

    def run(
        self,
        data_types: list[str] = None,
        days: int = None,
        full_sync: bool = False,
    ):
        """
        Run the sync process.

        Args:
            data_types: List of data types to sync (default: all)
            days: Number of days to look back (default: 7 or based on last sync)
            full_sync: If True, sync last 365 days
        """
        data_types = data_types or DATA_TYPES

        # Calculate date range
        end_date = date.today()

        if full_sync:
            start_date = end_date - timedelta(days=FULL_SYNC_LOOKBACK_DAYS)
            print(f"🔄 Starting FULL sync (last {FULL_SYNC_LOOKBACK_DAYS} days)")
        elif days:
            start_date = end_date - timedelta(days=days)
            print(f"🔄 Starting sync (last {days} days)")
        else:
            # Use incremental sync based on last sync date
            start_date = end_date - timedelta(days=DEFAULT_LOOKBACK_DAYS)
            print(f"🔄 Starting incremental sync (last {DEFAULT_LOOKBACK_DAYS} days)")

        print(f"📅 Date range: {start_date} to {end_date}")
        print(f"👤 User: {self.user_id}")
        print(f"📋 Data types: {', '.join(data_types)}")

        if self.dry_run:
            print("🧪 DRY RUN MODE - No data will be written")

        # Authenticate with Garmin
        print("\n🔐 Authenticating with Garmin Connect...")
        self.garmin.authenticate()

        # Sync each data type
        total_stats = {"fetched": 0, "created": 0, "updated": 0, "skipped": 0}

        for data_type in data_types:
            try:
                if data_type == "activities":
                    stats = self.sync_activities(start_date, end_date)
                elif data_type == "daily_summary":
                    stats = self.sync_daily_summaries(start_date, end_date)
                elif data_type == "sleep":
                    stats = self.sync_sleep(start_date, end_date)
                elif data_type == "hrv":
                    stats = self.sync_hrv(start_date, end_date)
                else:
                    print(f"⚠️  Unknown data type: {data_type}")
                    continue

                for key in total_stats:
                    total_stats[key] += stats[key]

            except Exception as e:
                print(f"❌ Failed to sync {data_type}: {e}")
                continue

        # Print summary
        print("\n" + "=" * 50)
        print("📊 SYNC SUMMARY")
        print("=" * 50)
        print(f"   Total fetched:  {total_stats['fetched']}")
        print(f"   Total created:  {total_stats['created']}")
        print(f"   Total updated:  {total_stats['updated']}")
        print(f"   Total skipped:  {total_stats['skipped']}")
        print("=" * 50)

        return total_stats


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Sync Garmin Connect data to Supabase"
    )
    parser.add_argument(
        "--full", action="store_true",
        help="Full sync (last 365 days)"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Print what would be synced without writing"
    )
    parser.add_argument(
        "--days", type=int,
        help="Number of days to look back"
    )
    parser.add_argument(
        "--type", type=str, choices=DATA_TYPES,
        help="Sync only a specific data type"
    )

    args = parser.parse_args()

    # Validate configuration
    try:
        validate_config()
    except ValueError as e:
        print(f"❌ Configuration error: {e}")
        print("\nPlease set the required environment variables in a .env file:")
        print("  GARMIN_EMAIL=your-email")
        print("  GARMIN_PASSWORD=your-password")
        print("  SUPABASE_URL=your-supabase-url")
        print("  SUPABASE_SERVICE_ROLE_KEY=your-service-key")
        print("  TRAINELO_USER_ID=your-user-uuid")
        sys.exit(1)

    # Run sync
    sync = GarminSync(dry_run=args.dry_run)

    data_types = [args.type] if args.type else None

    try:
        sync.run(
            data_types=data_types,
            days=args.days,
            full_sync=args.full,
        )
    except Exception as e:
        print(f"\n❌ Sync failed: {e}")
        sys.exit(1)

    print("\n✅ Sync completed successfully!")


if __name__ == "__main__":
    main()
