"""
Transform Garmin daily summary to canonical daily metrics schema.
"""

from typing import Any

from config import SOURCE, SCHEMA_VERSION


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

    return {
        "user_id": user_id,
        "source": SOURCE,
        "source_ref": source_ref,
        "schema_version": SCHEMA_VERSION,
        "date": date_str,
        # Activity metrics
        "steps": garmin_data.get("totalSteps"),
        "floors_climbed": garmin_data.get("floorsAscended"),
        "active_minutes": (
            (garmin_data.get("moderateIntensityMinutes") or 0) +
            (garmin_data.get("vigorousIntensityMinutes") or 0)
        ) or None,
        "sedentary_minutes": garmin_data.get("sedentarySeconds", 0) // 60 if garmin_data.get("sedentarySeconds") else None,
        # Calories
        "total_calories": garmin_data.get("totalKilocalories"),
        "active_calories": garmin_data.get("activeKilocalories"),
        # Heart rate
        "resting_heart_rate": garmin_data.get("restingHeartRate"),
        "max_heart_rate_observed": garmin_data.get("maxHeartRate"),
        # Stress
        "stress_avg": garmin_data.get("averageStressLevel"),
        "stress_max": garmin_data.get("maxStressLevel"),
        # Body battery
        "body_battery_high": garmin_data.get("bodyBatteryHighestValue"),
        "body_battery_low": garmin_data.get("bodyBatteryLowestValue"),
        # Respiration
        "respiration_rate": garmin_data.get("averageSpo2Value"),  # Note: this might be SpO2, not respiration
        # Blood oxygen
        "blood_oxygen_avg": garmin_data.get("averageSpo2Value"),
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
