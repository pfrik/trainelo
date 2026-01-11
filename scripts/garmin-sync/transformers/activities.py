"""
Transform Garmin activities to canonical workouts schema.
"""

from datetime import datetime
from typing import Any, Optional

from config import SOURCE, SCHEMA_VERSION


# Mapping of Garmin activity types to canonical types
ACTIVITY_TYPE_MAP = {
    "running": "run",
    "cycling": "bike",
    "swimming": "swim",
    "walking": "walk",
    "hiking": "hike",
    "strength_training": "strength",
    "yoga": "yoga",
    "pilates": "pilates",
    "elliptical": "elliptical",
    "stair_climbing": "stairs",
    "rowing": "row",
    "indoor_cycling": "bike_indoor",
    "indoor_running": "run_indoor",
    "treadmill_running": "run_indoor",
    "lap_swimming": "swim_pool",
    "open_water_swimming": "swim_open",
    "pool_swimming": "swim_pool",
    "virtual_ride": "bike_indoor",
    "virtual_run": "run_indoor",
    "trail_running": "run_trail",
    "mountain_biking": "bike_mtb",
    "gravel_cycling": "bike_gravel",
    "road_biking": "bike_road",
    "other": "other",
}


def _parse_timestamp(ts: Any) -> Optional[str]:
    """Parse Garmin timestamp to ISO format UTC."""
    if not ts:
        return None

    # Garmin returns timestamps in milliseconds
    if isinstance(ts, (int, float)):
        return datetime.utcfromtimestamp(ts / 1000).isoformat() + "Z"

    # Already a string
    if isinstance(ts, str):
        return ts

    return None


def _get_activity_type(garmin_data: dict[str, Any]) -> tuple[str, Optional[str]]:
    """
    Map Garmin activity type to canonical type.

    Returns:
        Tuple of (activity_type, activity_subtype)
    """
    activity_type_key = garmin_data.get("activityType", {})
    if isinstance(activity_type_key, dict):
        type_key = activity_type_key.get("typeKey", "other").lower()
    else:
        type_key = str(activity_type_key).lower() if activity_type_key else "other"

    # Clean up the type key
    type_key = type_key.replace(" ", "_").replace("-", "_")

    canonical_type = ACTIVITY_TYPE_MAP.get(type_key, "other")

    # Extract subtype if available
    subtype = None
    if "activityTypeDTO" in garmin_data:
        subtype = garmin_data["activityTypeDTO"].get("parentTypeId")

    return canonical_type, subtype


def transform_activity(
    garmin_data: dict[str, Any], user_id: str
) -> dict[str, Any]:
    """
    Transform Garmin activity to canonical workout format.

    Args:
        garmin_data: Raw Garmin activity data
        user_id: Trainelo user ID

    Returns:
        Canonical workout record
    """
    activity_id = garmin_data.get("activityId")
    if not activity_id:
        raise ValueError("Activity missing activityId")

    activity_type, activity_subtype = _get_activity_type(garmin_data)

    # Parse timestamps
    start_time = _parse_timestamp(
        garmin_data.get("startTimeGMT") or garmin_data.get("startTimeLocal")
    )

    # Calculate end time from start + duration
    duration_seconds = garmin_data.get("duration")
    end_time = None
    if start_time and duration_seconds:
        start_dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
        from datetime import timedelta
        end_dt = start_dt + timedelta(seconds=duration_seconds)
        end_time = end_dt.isoformat().replace("+00:00", "Z")

    # Extract summary metrics
    summary = garmin_data.get("summaryDTO", {})

    return {
        "user_id": user_id,
        "source": SOURCE,
        "source_ref": str(activity_id),
        "schema_version": SCHEMA_VERSION,
        "activity_type": activity_type,
        "activity_subtype": activity_subtype,
        "title": garmin_data.get("activityName"),
        "started_at": start_time,
        "ended_at": end_time,
        "duration_seconds": int(duration_seconds) if duration_seconds else None,
        "distance_meters": garmin_data.get("distance"),
        "calories": int(garmin_data.get("calories", 0)) if garmin_data.get("calories") else None,
        "avg_heart_rate": (
            int(summary.get("averageHR") or garmin_data.get("averageHR", 0))
            if (summary.get("averageHR") or garmin_data.get("averageHR"))
            else None
        ),
        "max_heart_rate": (
            int(summary.get("maxHR") or garmin_data.get("maxHR", 0))
            if (summary.get("maxHR") or garmin_data.get("maxHR"))
            else None
        ),
        "min_heart_rate": (
            int(summary.get("minHR", 0))
            if summary.get("minHR")
            else None
        ),
        "avg_cadence": summary.get("averageRunCadence") or summary.get("averageBikeCadence"),
        "max_cadence": summary.get("maxRunCadence") or summary.get("maxBikeCadence"),
        "avg_power_watts": summary.get("avgPower"),
        "max_power_watts": summary.get("maxPower"),
        "normalized_power_watts": summary.get("normPower"),
        "training_stress_score": summary.get("trainingStressScore"),
        "intensity_factor": summary.get("intensityFactor"),
        "elevation_gain_meters": garmin_data.get("elevationGain"),
        "elevation_loss_meters": garmin_data.get("elevationLoss"),
        "raw_data": garmin_data,
    }


def get_activity_date(garmin_data: dict[str, Any]) -> str:
    """
    Extract the date from a Garmin activity for storage key.

    Args:
        garmin_data: Raw Garmin activity data

    Returns:
        Date string in YYYY-MM-DD format
    """
    start_time = garmin_data.get("startTimeGMT") or garmin_data.get("startTimeLocal")

    if isinstance(start_time, (int, float)):
        dt = datetime.utcfromtimestamp(start_time / 1000)
        return dt.strftime("%Y-%m-%d")

    if isinstance(start_time, str):
        # Parse ISO format
        try:
            dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Fallback to today
    return datetime.utcnow().strftime("%Y-%m-%d")
