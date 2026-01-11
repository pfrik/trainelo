"""
Transform Garmin sleep data to canonical sleep sessions schema.
"""

from datetime import datetime
from typing import Any, Optional

from config import SOURCE, SCHEMA_VERSION


def _parse_timestamp_ms(ts: Any) -> Optional[str]:
    """Parse Garmin timestamp (milliseconds) to ISO format UTC."""
    if not ts:
        return None

    if isinstance(ts, (int, float)):
        return datetime.utcfromtimestamp(ts / 1000).isoformat() + "Z"

    return None


def transform_sleep(
    garmin_data: dict[str, Any], user_id: str
) -> dict[str, Any]:
    """
    Transform Garmin sleep data to canonical sleep session format.

    Args:
        garmin_data: Raw Garmin sleep data
        user_id: Trainelo user ID

    Returns:
        Canonical sleep session record
    """
    # Get the daily sleep DTO which contains the main sleep metrics
    daily_sleep = garmin_data.get("dailySleepDTO", {})

    if not daily_sleep:
        raise ValueError("Sleep data missing dailySleepDTO")

    # Extract sleep ID or generate from date
    sleep_id = daily_sleep.get("id")
    calendar_date = daily_sleep.get("calendarDate")

    if not sleep_id and not calendar_date:
        raise ValueError("Sleep data missing id and calendarDate")

    source_ref = str(sleep_id) if sleep_id else f"sleep_{calendar_date}"

    # Parse sleep start and end times
    sleep_start = _parse_timestamp_ms(daily_sleep.get("sleepStartTimestampGMT"))
    sleep_end = _parse_timestamp_ms(daily_sleep.get("sleepEndTimestampGMT"))

    # Extract sleep stage durations (in seconds)
    sleep_levels = daily_sleep.get("sleepLevels", {}) or {}

    deep_seconds = sleep_levels.get("deepSleepSeconds", 0) or daily_sleep.get("deepSleepSeconds", 0)
    light_seconds = sleep_levels.get("lightSleepSeconds", 0) or daily_sleep.get("lightSleepSeconds", 0)
    rem_seconds = sleep_levels.get("remSleepSeconds", 0) or daily_sleep.get("remSleepSeconds", 0)
    awake_seconds = sleep_levels.get("awakeSleepSeconds", 0) or daily_sleep.get("awakeSleepSeconds", 0)

    # Total duration
    duration_seconds = daily_sleep.get("sleepTimeSeconds")

    # Sleep quality metrics
    sleep_score = daily_sleep.get("sleepScores", {}).get("overall") if daily_sleep.get("sleepScores") else None

    # Awakening count
    awakenings = daily_sleep.get("awakeCount")

    # Physiological metrics during sleep
    avg_hr = daily_sleep.get("avgSleepingHR")
    min_hr = daily_sleep.get("minSleepingHR")
    avg_respiration = daily_sleep.get("avgRespirationRate")
    avg_spo2 = daily_sleep.get("avgSpo2Value")
    avg_stress = daily_sleep.get("avgSleepStress")

    # HRV during sleep
    hrv_summary = garmin_data.get("hrvSummary", {}) or {}
    avg_hrv = hrv_summary.get("weeklyAvg")

    return {
        "user_id": user_id,
        "source": SOURCE,
        "source_ref": source_ref,
        "schema_version": SCHEMA_VERSION,
        "date": calendar_date,
        "sleep_start": sleep_start,
        "sleep_end": sleep_end,
        "duration_seconds": duration_seconds,
        "deep_seconds": deep_seconds if deep_seconds else None,
        "light_seconds": light_seconds if light_seconds else None,
        "rem_seconds": rem_seconds if rem_seconds else None,
        "awake_seconds": awake_seconds if awake_seconds else None,
        "awakenings": awakenings,
        "sleep_score": sleep_score,
        "efficiency_percent": None,  # Garmin doesn't directly provide this
        "latency_seconds": None,  # Time to fall asleep - not directly available
        "avg_heart_rate": int(avg_hr) if avg_hr else None,
        "min_heart_rate": int(min_hr) if min_hr else None,
        "avg_hrv_ms": avg_hrv,
        "avg_respiration_rate": avg_respiration,
        "avg_blood_oxygen": avg_spo2,
        "avg_stress": avg_stress,
        "raw_data": garmin_data,
    }


def get_sleep_date(garmin_data: dict[str, Any]) -> str:
    """
    Extract the date from Garmin sleep data.

    Args:
        garmin_data: Raw Garmin sleep data

    Returns:
        Date string in YYYY-MM-DD format
    """
    daily_sleep = garmin_data.get("dailySleepDTO", {})
    return daily_sleep.get("calendarDate", garmin_data.get("requestDate", ""))


def get_sleep_id(garmin_data: dict[str, Any]) -> str:
    """
    Extract the sleep ID from Garmin sleep data.

    Args:
        garmin_data: Raw Garmin sleep data

    Returns:
        Sleep ID string
    """
    daily_sleep = garmin_data.get("dailySleepDTO", {})
    sleep_id = daily_sleep.get("id")

    if sleep_id:
        return str(sleep_id)

    # Fallback to date-based ID
    calendar_date = daily_sleep.get("calendarDate", garmin_data.get("requestDate", ""))
    return f"sleep_{calendar_date}"
