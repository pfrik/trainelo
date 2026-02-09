"""
Transform Garmin sleep data to canonical sleep sessions schema.
"""

from datetime import datetime
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


def _parse_timestamp_ms(ts: Any) -> Optional[str]:
    """Parse Garmin timestamp (milliseconds) to ISO format UTC."""
    if not ts:
        return None

    if isinstance(ts, (int, float)):
        return datetime.utcfromtimestamp(ts / 1000).isoformat() + "Z"

    return None


def _extract_sleep_score(daily_sleep: dict[str, Any]) -> Optional[int]:
    """
    Extract sleep score from Garmin payload, trying multiple known key paths.

    Garmin has changed the payload structure across API versions:
      - sleepScores.overall.value  (newer nested object)
      - sleepScores.overall        (direct int)
      - sleepScores.qualityScore
      - sleepScores.totalScore
      - overallScore               (top-level in dailySleepDTO)
    """
    sleep_scores = daily_sleep.get("sleepScores")
    if sleep_scores and isinstance(sleep_scores, dict):
        # Try overall.value (nested object with value key)
        overall = sleep_scores.get("overall")
        if isinstance(overall, dict):
            val = overall.get("value") or overall.get("qualifierKey")
            if val is not None:
                return _to_int(val)
        # Try overall as a direct int/float
        if isinstance(overall, (int, float)):
            return _to_int(overall)
        # Try alternate keys inside sleepScores
        for key in ("qualityScore", "totalScore", "overallScore"):
            val = sleep_scores.get(key)
            if val is not None:
                return _to_int(val)

    # Top-level fallback keys on dailySleepDTO
    for key in ("overallScore", "sleepQualityScore", "sleepScore"):
        val = daily_sleep.get(key)
        if val is not None:
            return _to_int(val)

    return None


def _compute_sleep_seconds(
    daily_sleep: dict[str, Any],
    deep: Optional[int],
    light: Optional[int],
    rem: Optional[int],
    awake: Optional[int],
    sleep_start_ts: Any,
    sleep_end_ts: Any,
) -> Optional[int]:
    """
    Compute actual sleep time (excluding awake) with a 3-level fallback:
      1) sleepTimeSeconds from the payload  (Garmin's own calculation)
      2) deep + light + rem                 (sum of stages)
      3) duration from timestamps - awake   (bed time minus awake)
    """
    # 1) Direct from payload
    raw = daily_sleep.get("sleepTimeSeconds")
    if raw is not None:
        val = _to_int(raw)
        if val and val > 0:
            return val

    # 2) Sum of stages (only if all three are present)
    if deep is not None and light is not None and rem is not None:
        total = deep + light + rem
        if total > 0:
            return total

    # 3) Duration from timestamps minus awake
    if sleep_start_ts and sleep_end_ts:
        try:
            if isinstance(sleep_start_ts, (int, float)) and isinstance(sleep_end_ts, (int, float)):
                duration = int((sleep_end_ts - sleep_start_ts) / 1000)
            else:
                duration = None
        except (TypeError, ValueError):
            duration = None

        if duration and duration > 0:
            return duration - (awake or 0)

    return None


def transform_sleep(
    garmin_data: dict[str, Any], user_id: str
) -> Optional[dict[str, Any]]:
    """
    Transform Garmin sleep data to canonical sleep session format.

    Args:
        garmin_data: Raw Garmin sleep data
        user_id: Trainelo user ID

    Returns:
        Canonical sleep session record, or None if required fields are missing
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
    raw_start = daily_sleep.get("sleepStartTimestampGMT")
    raw_end = daily_sleep.get("sleepEndTimestampGMT")
    sleep_start = _parse_timestamp_ms(raw_start)
    sleep_end = _parse_timestamp_ms(raw_end)

    # Skip records missing required sleep_start field
    if not sleep_start:
        print(f"   [DEBUG] Skipping sleep record {calendar_date}: missing sleep_start timestamp")
        return None

    # Extract sleep stage durations (in seconds)
    sleep_levels = daily_sleep.get("sleepLevels", {}) or {}

    deep_seconds = _to_int(
        sleep_levels.get("deepSleepSeconds") or daily_sleep.get("deepSleepSeconds")
    )
    light_seconds = _to_int(
        sleep_levels.get("lightSleepSeconds") or daily_sleep.get("lightSleepSeconds")
    )
    rem_seconds = _to_int(
        sleep_levels.get("remSleepSeconds") or daily_sleep.get("remSleepSeconds")
    )
    awake_seconds = _to_int(
        sleep_levels.get("awakeSleepSeconds") or daily_sleep.get("awakeSleepSeconds")
    )

    # Sleep quality score (robust multi-path extraction)
    sleep_score = _extract_sleep_score(daily_sleep)

    # Actual sleep seconds (excluding awake time)
    sleep_seconds = _compute_sleep_seconds(
        daily_sleep, deep_seconds, light_seconds, rem_seconds, awake_seconds,
        raw_start, raw_end,
    )

    # Awakening count
    awakenings = daily_sleep.get("awakeCount")

    # Physiological metrics during sleep
    avg_hr = daily_sleep.get("avgSleepingHR")
    min_hr = daily_sleep.get("minSleepingHR")
    avg_respiration = daily_sleep.get("avgRespirationRate")
    avg_spo2 = daily_sleep.get("avgSpo2Value")
    avg_stress = daily_sleep.get("avgSleepStress")

    # HRV during sleep — prefer nightly avg over weekly avg
    hrv_summary = garmin_data.get("hrvSummary", {}) or {}
    avg_hrv = (
        hrv_summary.get("lastNightAvg")
        or hrv_summary.get("weeklyAvg")
    )

    # --- Debug logging for key fields ---
    if sleep_score is None:
        print(f"   [DEBUG] sleep {calendar_date}: sleep_score is NULL "
              f"(sleepScores keys: {list((daily_sleep.get('sleepScores') or {}).keys())})")
    if sleep_seconds is None:
        print(f"   [DEBUG] sleep {calendar_date}: sleep_seconds is NULL "
              f"(sleepTimeSeconds={daily_sleep.get('sleepTimeSeconds')}, "
              f"deep={deep_seconds}, light={light_seconds}, rem={rem_seconds})")
    if avg_hrv is None:
        print(f"   [DEBUG] sleep {calendar_date}: avg_hrv_ms is NULL "
              f"(hrvSummary keys: {list(hrv_summary.keys())})")
    if avg_hr is None:
        print(f"   [DEBUG] sleep {calendar_date}: avg_heart_rate is NULL")

    return {
        "user_id": user_id,
        "source": SOURCE,
        "source_ref": source_ref,
        "schema_version": SCHEMA_VERSION,
        "date": calendar_date,
        "sleep_start": sleep_start,
        "sleep_end": sleep_end,
        # Note: duration_seconds is a generated column in the DB, don't include it
        "sleep_seconds": sleep_seconds,
        "deep_seconds": deep_seconds,
        "light_seconds": light_seconds,
        "rem_seconds": rem_seconds,
        "awake_seconds": awake_seconds,
        "awakenings": _to_int(awakenings),
        "sleep_score": sleep_score,
        "efficiency_percent": None,  # Garmin doesn't directly provide this
        "latency_seconds": None,  # Time to fall asleep - not directly available
        "avg_heart_rate": _to_int(avg_hr),
        "min_heart_rate": _to_int(min_hr),
        "avg_hrv_ms": avg_hrv,  # keep as numeric, not int-truncated
        "avg_respiration_rate": avg_respiration,
        "avg_blood_oxygen": avg_spo2,
        "avg_stress": _to_int(avg_stress),
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
