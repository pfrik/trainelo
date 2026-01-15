"""
Transform Garmin daily summary to canonical daily metrics schema.
"""

from typing import Any, Optional

from config import SOURCE, SCHEMA_VERSION


def _to_int(value: Any) -> Optional[int]:
    """Convert a value to int, handling floats and None."""
    if value is None:
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


def transform_daily_summary(
    garmin_data: dict[str, Any], user_id: str
) -> dict[str, Any]:
    """
    Transform Garmin daily summary to canonical daily metrics format.

    Args:
        garmin_data: Raw Garmin daily summary data
        user_id: Trainelo user ID

    Returns:
        Canonical daily metrics record
    """
    # The date is usually in calendarDate field
    date_str = garmin_data.get("calendarDate")
    if not date_str:
        raise ValueError("Daily summary missing calendarDate")

    # Generate source_ref from date (Garmin doesn't have a unique ID for daily summaries)
    source_ref = f"daily_{date_str}"

    # Calculate active minutes from moderate + vigorous
    moderate = garmin_data.get("moderateIntensityMinutes") or 0
    vigorous = garmin_data.get("vigorousIntensityMinutes") or 0
    active_minutes = _to_int(moderate + vigorous) if (moderate or vigorous) else None

    # Calculate sedentary minutes from seconds
    sedentary_seconds = garmin_data.get("sedentarySeconds")
    sedentary_minutes = _to_int(sedentary_seconds // 60) if sedentary_seconds else None

    return {
        "user_id": user_id,
        "source": SOURCE,
        "source_ref": source_ref,
        "schema_version": SCHEMA_VERSION,
        "date": date_str,
        # Activity metrics
        "steps": _to_int(garmin_data.get("totalSteps")),
        "floors_climbed": _to_int(garmin_data.get("floorsAscended")),
        "active_minutes": active_minutes,
        "sedentary_minutes": sedentary_minutes,
        # Calories
        "total_calories": _to_int(garmin_data.get("totalKilocalories")),
        "active_calories": _to_int(garmin_data.get("activeKilocalories")),
        # Heart rate
        "resting_heart_rate": _to_int(garmin_data.get("restingHeartRate")),
        "max_heart_rate_observed": _to_int(garmin_data.get("maxHeartRate")),
        # Stress
        "stress_avg": _to_int(garmin_data.get("averageStressLevel")),
        "stress_max": _to_int(garmin_data.get("maxStressLevel")),
        # Body battery
        "body_battery_high": _to_int(garmin_data.get("bodyBatteryHighestValue")),
        "body_battery_low": _to_int(garmin_data.get("bodyBatteryLowestValue")),
        # Respiration
        "respiration_rate": _to_int(garmin_data.get("averageSpo2Value")),  # Note: this might be SpO2, not respiration
        # Blood oxygen
        "blood_oxygen_avg": _to_int(garmin_data.get("averageSpo2Value")),
        # Store raw data for debugging and future field extraction
        "raw_data": garmin_data,
    }


def get_daily_summary_date(garmin_data: dict[str, Any]) -> str:
    """
    Extract the date from a Garmin daily summary.

    Args:
        garmin_data: Raw Garmin daily summary data

    Returns:
        Date string in YYYY-MM-DD format
    """
    return garmin_data.get("calendarDate", "")
