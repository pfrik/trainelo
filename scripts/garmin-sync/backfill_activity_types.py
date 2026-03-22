#!/usr/bin/env python3
"""
Backfill activity types, duration, and distance from raw_data stored in workouts table.

The raw_data JSONB column contains the full Garmin payload. This script
re-runs the (fixed) extraction logic against it to correct records that
were stored with activity_type='other' or duration_seconds=0.

Usage:
    python backfill_activity_types.py --dry-run   # Preview changes
    python backfill_activity_types.py              # Apply changes
"""

import argparse
import sys

from config import validate_config
from supabase_client import SupabaseClient
from transformers.activities import _get_activity_type, _to_int


def backfill(dry_run: bool = False):
    validate_config()
    client = SupabaseClient()

    # Fetch all garmin workouts with raw_data
    print("Fetching Garmin workouts with raw_data...")
    params = {
        "select": "id,source_ref,activity_type,duration_seconds,distance_meters,calories,title,raw_data",
        "source": "eq.garmin",
        "raw_data": "not.is.null",
        "order": "started_at.desc",
    }
    response = client._request("GET", "workouts", params=params)
    workouts = response.json()
    print(f"Found {len(workouts)} Garmin workouts\n")

    fixed = 0
    skipped = 0

    for workout in workouts:
        raw = workout.get("raw_data")
        if not raw or not isinstance(raw, dict):
            skipped += 1
            continue

        # Re-extract with fixed logic
        new_type, new_subtype = _get_activity_type(raw)

        summary = raw.get("summaryDTO", {})
        new_duration = _to_int(
            raw.get("duration")
            or summary.get("duration")
            or summary.get("elapsedDuration")
            or summary.get("movingDuration")
        )
        new_distance = _to_int(
            raw.get("distance") or summary.get("distance")
        )
        new_calories = _to_int(
            raw.get("calories") or summary.get("calories")
        )
        new_title = raw.get("activityName")

        # Build changes dict (only include fields that actually changed)
        changes = {}
        if new_type != workout.get("activity_type"):
            changes["activity_type"] = new_type
        if new_duration and new_duration != workout.get("duration_seconds"):
            changes["duration_seconds"] = new_duration
        if new_distance and new_distance != workout.get("distance_meters"):
            changes["distance_meters"] = new_distance
        if new_calories and new_calories != workout.get("calories"):
            changes["calories"] = new_calories
        if new_title and new_title != workout.get("title"):
            changes["title"] = new_title

        if not changes:
            skipped += 1
            continue

        ref = workout.get("source_ref", "?")
        old_type = workout.get("activity_type", "?")

        if dry_run:
            print(f"  [DRY RUN] {ref}: {old_type} -> {changes}")
        else:
            try:
                params = {"id": f"eq.{workout['id']}"}
                extra_headers = {"Prefer": "return=minimal"}
                client._request("PATCH", "workouts", params=params, json=changes, extra_headers=extra_headers)
                print(f"  [OK] {ref}: {old_type} -> {changes}")
            except Exception as e:
                print(f"  [FAIL] {ref}: Failed to update: {e}")

        fixed += 1

    print(f"\n{'Would fix' if dry_run else 'Fixed'} {fixed} / {len(workouts)} workouts ({skipped} unchanged)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill activity types from raw_data")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without applying")
    args = parser.parse_args()

    backfill(dry_run=args.dry_run)
