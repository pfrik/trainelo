"""
Transform Garmin HRV data to canonical HRV nights schema.
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


def _get_hrv_status(status_value: Any) -> Optional[str]:
    """
    Map Garmin HRV status to canonical status.

    Garmin uses numeric status:
    - 0: Unknown
    - 1: Poor
    - 2: Low
    - 3: Balanced
    - 4: Good

    Returns canonical string status.
    """
    if status_value is None:
        return None

    status_map = {
        0: "unknown",
        1: "poor",
        2: "low",
        3: "balanced",
        4: "good",
    }

    if isinstance(status_value, int):
        return status_map.get(status_value, "unknown")

    if isinstance(status_value, str):
        return status_value.lower()

    return "unknown"


def transform_hrv(
    garmin_data: dict[str, Any], user_id: str
) -> dict[str, Any]:
    """
    Transform Garmin HRV data to canonical HRV night format.

    Args:
        garmin_data: Raw Garmin HRV data
        user_id: Trainelo user ID

    Returns:
        Canonical HRV night record
    """
    hrv_summary = garmin_data.get("hrvSummary", {})

    if not hrv_summary:
        raise ValueError("HRV data missing hrvSummary")

    # Get the date - try multiple sources
    calendar_date = (
        hrv_summary.get("calendarDate") or
        garmin_data.get("requestDate") or
        garmin_data.get("calendarDate")
    )

    if not calendar_date:
        raise ValueError("HRV data missing calendar date")

    # Generate source_ref from date (Garmin doesn't have unique HRV IDs)
    source_ref = f"hrv_{calendar_date}"

    # Extract HRV values
    # Garmin provides different HRV metrics:
    # - lastNightAvg: Average HRV from last night
    # - lastNight5MinHigh: Highest 5-minute average
    # - weeklyAvg: 7-day rolling average
    # - baseline: Baseline HRV

    hrv_rmssd = hrv_summary.get("lastNightAvg")
    weekly_avg = hrv_summary.get("weeklyAvg")
    hrv_baseline = hrv_summary.get("baseline", {}).get("balancedUpper") if isinstance(hrv_summary.get("baseline"), dict) else hrv_summary.get("baseline")

    # HRV status
    status = _get_hrv_status(hrv_summary.get("status"))

    # Get reading count
    reading_count = hrv_summary.get("lastNightNumReadings")

    # Get 7-day change percentage
    change_percent = None
    if weekly_avg and hrv_baseline:
        try:
            change_percent = ((weekly_avg - hrv_baseline) / hrv_baseline) * 100
        except (TypeError, ZeroDivisionError):
            pass

    # Measurement times
    start_time = _parse_timestamp_ms(hrv_summary.get("startTimestampGMT"))
    end_time = _parse_timestamp_ms(hrv_summary.get("endTimestampGMT"))

    # Physiological metrics
    avg_hr = hrv_summary.get("avgHeartRate")
    resp_rate = hrv_summary.get("avgRespirationRate")

    return {
        "user_id": user_id,
        "source": SOURCE,
        "source_ref": source_ref,
        "schema_version": SCHEMA_VERSION,
        "date": calendar_date,
        "hrv_rmssd": hrv_rmssd,
        "hrv_status": status,
        "weekly_avg": weekly_avg,
        "hrv_baseline": hrv_baseline,
        "seven_day_change_percent": round(change_percent, 1) if change_percent else None,
        "reading_count": reading_count,
        "measurement_start": start_time,
        "measurement_end": end_time,
        "avg_heart_rate": int(avg_hr) if avg_hr else None,
        "respiratory_rate": resp_rate,
        "raw_data": garmin_data,
    }


def get_hrv_date(garmin_data: dict[str, Any]) -> str:
    """
    Extract the date from Garmin HRV data.

    Args:
        garmin_data: Raw Garmin HRV data

    Returns:
        Date string in YYYY-MM-DD format
    """
    hrv_summary = garmin_data.get("hrvSummary", {})
    return (
        hrv_summary.get("calendarDate") or
        garmin_data.get("requestDate") or
        ""
    )


def get_hrv_id(garmin_data: dict[str, Any]) -> str:
    """
    Extract/generate HRV ID from Garmin data.

    Args:
        garmin_data: Raw Garmin HRV data

    Returns:
        HRV ID string
    """
    date = get_hrv_date(garmin_data)
    return f"hrv_{date}"
