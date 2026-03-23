#!/usr/bin/env python3
"""
Backfill detailed activity metrics from raw_data stored in workouts table.

Re-extracts avg_speed, training effect, VO2 max, running dynamics, etc.
from the already-stored Garmin JSON payload. No re-fetching from Garmin needed.

Usage:
    python backfill_activity_details.py --dry-run   # Preview changes
    python backfill_activity_details.py              # Apply changes
"""

import argparse
import sys

from config import validate_config
from supabase_client import SupabaseClient
from transformers.activities import _to_int


FIELDS_TO_BACKFILL = [
    "avg_speed_mps",
    "max_speed_mps",
    "moving_duration_seconds",
    "elapsed_duration_seconds",
    "aerobic_training_effect",
    "anaerobic_training_effect",
    "vo2max_value",
    "avg_stride_length_cm",
    "avg_vertical_oscillation_cm",
    "avg_ground_contact_time_ms",
]


def extract_details(raw_data: dict) -> dict:
    """Extract detailed metrics from Garmin raw_data payload."""
    summary = raw_data.get("summaryDTO", {})

    return {
        # Speed
        "avg_speed_mps": summary.get("averageSpeed"),
        "max_speed_mps": summary.get("maxSpeed"),
        # Duration
        "moving_duration_seconds": _to_int(summary.get("movingDuration")),
        "elapsed_duration_seconds": _to_int(summary.get("elapsedDuration")),
        # Training effect
        "aerobic_training_effect": summary.get("trainingEffect"),
        "anaerobic_training_effect": summary.get("anaerobicTrainingEffect"),
        # VO2 Max not available in detail endpoint
        "vo2max_value": None,
        # Running dynamics (strideLength is already in cm)
        "avg_stride_length_cm": (
            round(summary["strideLength"], 2)
            if summary.get("strideLength") else None
        ),
        "avg_vertical_oscillation_cm": summary.get("verticalOscillation"),
        "avg_ground_contact_time_ms": summary.get("groundContactTime"),
        # Also fix power and elevation while backfilling
        "avg_power_watts": _to_int(summary.get("averagePower")),
        "normalized_power_watts": _to_int(summary.get("normalizedPower")),
        "elevation_gain_meters": _to_int(summary.get("elevationGain")),
        "elevation_loss_meters": _to_int(summary.get("elevationLoss")),
    }


def backfill(dry_run: bool = False):
    validate_config()
    client = SupabaseClient()

    print("Fetching Garmin workouts with raw_data...")
    resp = client._request(
        "GET", "workouts",
        params={
            "select": "id,title,activity_type,raw_data",
            "source": "eq.garmin",
            "raw_data": "not.is.null",
        },
    )
    resp.raise_for_status()
    workouts = resp.json()
    print(f"Found {len(workouts)} workouts with raw_data")

    updated = 0
    skipped = 0

    for workout in workouts:
        raw_data = workout.get("raw_data")
        if not raw_data or not isinstance(raw_data, dict):
            skipped += 1
            continue

        details = extract_details(raw_data)

        # Only update if we have at least one non-null value
        non_null = {k: v for k, v in details.items() if v is not None}
        if not non_null:
            skipped += 1
            continue

        title = workout.get("title") or workout.get("activity_type") or "unknown"

        if dry_run:
            print(f"  Would update {title}: {list(non_null.keys())}")
        else:
            patch_resp = client._request(
                "PATCH", "workouts",
                params={"id": f"eq.{workout['id']}"},
                json=non_null,
            )
            patch_resp.raise_for_status()
            print(f"  Updated: {title} ({len(non_null)} fields)")

        updated += 1

    print(f"\nDone. Updated: {updated}, Skipped: {skipped}")


def main():
    parser = argparse.ArgumentParser(
        description="Backfill detailed activity metrics from raw_data"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Preview changes without writing"
    )
    args = parser.parse_args()

    try:
        backfill(dry_run=args.dry_run)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
