"""
Blob storage client for raw payload storage.
Stores raw JSON payloads to Supabase Storage before transformation.
"""

import hashlib
import json
from datetime import date
from typing import Any

from supabase import create_client, Client

from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SOURCE


class BlobStorage:
    """Handles raw payload storage in Supabase Storage."""

    BUCKET_NAME = "raw-payloads"

    def __init__(self):
        self.client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    def _compute_hash(self, data: dict[str, Any]) -> str:
        """
        Compute SHA256 hash of JSON data.

        Args:
            data: Dictionary to hash

        Returns:
            Hex string of SHA256 hash (first 16 chars)
        """
        json_str = json.dumps(data, sort_keys=True, default=str)
        return hashlib.sha256(json_str.encode()).hexdigest()[:16]

    def _generate_key(
        self,
        user_id: str,
        data_type: str,
        target_date: date,
        external_id: str,
        data: dict[str, Any],
    ) -> str:
        """
        Generate deterministic storage key.

        Format: raw/{provider}/{user_id}/{yyyy-mm-dd}/{type}_{external_id}_{hash}.json

        Args:
            user_id: User ID
            data_type: Type of data (activities, daily_summary, sleep, hrv)
            target_date: Date of the data
            external_id: External ID from Garmin
            data: Raw data (used for hash computation)

        Returns:
            Storage key path
        """
        data_hash = self._compute_hash(data)
        date_str = target_date.isoformat()

        return f"raw/{SOURCE}/{user_id}/{date_str}/{data_type}_{external_id}_{data_hash}.json"

    def store_raw_payload(
        self,
        user_id: str,
        data_type: str,
        target_date: date,
        external_id: str,
        data: dict[str, Any],
    ) -> str:
        """
        Store raw JSON payload to blob storage.

        Args:
            user_id: User ID
            data_type: Type of data
            target_date: Date of the data
            external_id: External ID from source
            data: Raw data to store

        Returns:
            Storage key path
        """
        key = self._generate_key(user_id, data_type, target_date, external_id, data)

        # Convert to JSON bytes
        json_bytes = json.dumps(data, indent=2, default=str).encode("utf-8")

        # Upload to storage (upsert mode)
        self.client.storage.from_(self.BUCKET_NAME).upload(
            path=key,
            file=json_bytes,
            file_options={"content-type": "application/json", "upsert": "true"},
        )

        return key

    def get_raw_payload(self, key: str) -> dict[str, Any]:
        """
        Retrieve raw JSON payload from blob storage.

        Args:
            key: Storage key path

        Returns:
            Parsed JSON data
        """
        response = self.client.storage.from_(self.BUCKET_NAME).download(key)
        return json.loads(response)

    def check_payload_exists(
        self,
        user_id: str,
        data_type: str,
        target_date: date,
        external_id: str,
        data: dict[str, Any],
    ) -> bool:
        """
        Check if a payload with the same hash already exists.

        Args:
            user_id: User ID
            data_type: Type of data
            target_date: Date of the data
            external_id: External ID
            data: Raw data

        Returns:
            True if payload exists
        """
        key = self._generate_key(user_id, data_type, target_date, external_id, data)

        try:
            # Try to get file info
            self.client.storage.from_(self.BUCKET_NAME).download(key)
            return True
        except Exception:
            return False
