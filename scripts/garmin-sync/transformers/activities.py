"""
Transform Garmin activities to canonical workouts schema.
"""

from datetime import datetime
from typing import Any, Optional

from config import SOURCE, SCHEMA_VERSION


def _to_int(value: Any) -> Optional[int]:
    """Convert a value to int, handling floats and None."""
    if value is None:
        return None
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return None


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
    "track_running": "run",
    "street_running": "run",
    "indoor_cardio": "cardio",
    "cardio_training": "cardio",
    "fitness_equipment": "strength",
    "indoor_rowing": "row",
    "resort_skiing": "ski",
    "cross_country_skiing": "ski_xc",
    "backcountry_skiing": "ski_bc",
    "multi_sport": "multi",
    "transition": "transition",
    "breathwork": "breathwork",
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

    Handles both API response structures:
    - Detail endpoint: activityTypeDTO.typeKey
    - List endpoint:   activityType.typeKey

    Returns:
        Tuple of (activity_type, activity_subtype)
    """
    type_key = "other"
    subtype = None

    # Try detail endpoint structure first (activityTypeDTO)
    activity_type_dto = garmin_data.get("activityTypeDTO")
    if isinstance(activity_type_dto, dict):
        type_key = activity_type_dto.get("typeKey", "other").lower()
        subtype = activity_type_dto.get("parentTypeId")
    else:
        # Fall back to list endpoint structure (activityType)
        activity_type_key = garmin_data.get("activityType", {})
        if isinstance(activity_type_key, dict):
            type_key = activity_type_key.get("typeKey", "other").lower()
        elif activity_type_key:
            type_key = str(activity_type_key).lower()

    # Clean up the type key
    type_key = type_key.replace(" ", "_").replace("-", "_")

    canonical_type = ACTIVITY_TYPE_MAP.get(type_key, "other")

    if canonical_type == "other" and type_key != "other":
        print(f"   [WARN] Unmapped Garmin activity type: '{type_key}' -> defaulting to 'other'")

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

    # Parse timestamps - try multiple possible field names
    # Garmin API returns different fields for list vs detail endpoints
    start_time = _parse_timestamp(
        garmin_data.get("startTimeGMT")
        or garmin_data.get("startTimeLocal")
        or garmin_data.get("beginTimestamp")
        or garmin_data.get("startTimestamp")
        or garmin_data.get("startTimeInSeconds")  # Some APIs return epoch seconds
    )

    # Also check nested summaryDTO for timestamps
    if not start_time:
        summary = garmin_data.get("summaryDTO", {})
        start_time = _parse_timestamp(
            summary.get("startTimeGMT")
            or summary.get("startTimeLocal")
            or summary.get("beginTimestamp")
        )

    if not start_time:
        # Debug: print available keys to help diagnose
        keys = list(garmin_data.keys())
        raise ValueError(f"Activity {activity_id} missing start time. Available keys: {keys[:15]}...")

    activity_type, activity_subtype = _get_activity_type(garmin_data)

    # Extract summary metrics (needed before duration calculation)
    summary = garmin_data.get("summaryDTO", {})

    # Extract duration — check top-level first, then summaryDTO
    duration_seconds = (
        garmin_data.get("duration")
        or summary.get("duration")
        or summary.get("elapsedDuration")
        or summary.get("movingDuration")
    )

    # Calculate end time from start + duration
    end_time = None
    if start_time and duration_seconds:
        start_dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
        from datetime import timedelta
        end_dt = start_dt + timedelta(seconds=duration_seconds)
        end_time = end_dt.isoformat().replace("+00:00", "Z")

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
        "duration_seconds": _to_int(duration_seconds),
        "distance_meters": _to_int(garmin_data.get("distance") or summary.get("distance")),
        "calories": _to_int(garmin_data.get("calories") or summary.get("calories")),
        "avg_heart_rate": _to_int(summary.get("averageHR") or garmin_data.get("averageHR")),
        "max_heart_rate": _to_int(summary.get("maxHR") or garmin_data.get("maxHR")),
        "min_heart_rate": _to_int(summary.get("minHR")),
        "avg_cadence": _to_int(summary.get("averageRunCadence") or summary.get("averageBikeCadence")),
        "max_cadence": _to_int(summary.get("maxRunCadence") or summary.get("maxBikeCadence")),
        "avg_power_watts": _to_int(summary.get("avgPower")),
        "max_power_watts": _to_int(summary.get("maxPower")),
        "normalized_power_watts": _to_int(summary.get("normPower")),
        "training_stress_score": _to_int(summary.get("trainingStressScore")),
        "intensity_factor": summary.get("intensityFactor"),  # This is a decimal, not int
        "elevation_gain_meters": _to_int(garmin_data.get("elevationGain")),
        "elevation_loss_meters": _to_int(garmin_data.get("elevationLoss")),
        # Detailed metrics (from summaryDTO / top-level)
        "avg_speed_mps": summary.get("averageSpeed"),
        "max_speed_mps": summary.get("maxSpeed"),
        "moving_duration_seconds": _to_int(summary.get("movingDuration")),
        "elapsed_duration_seconds": _to_int(summary.get("elapsedDuration")),
        "aerobic_training_effect": summary.get("trainingEffect"),
        "anaerobic_training_effect": summary.get("anaerobicTrainingEffect"),
        "vo2max_value": garmin_data.get("vO2MaxValue"),
        "avg_stride_length_cm": (
            round(summary.get("averageStrideLength", 0) * 100, 2)
            if summary.get("averageStrideLength") else None
        ),
        "avg_vertical_oscillation_cm": summary.get("avgVerticalOscillation"),
        "avg_ground_contact_time_ms": summary.get("avgGroundContactTime"),
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
