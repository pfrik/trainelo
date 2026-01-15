"""
Blob storage client for raw payload storage.
Stores raw JSON payloads to Supabase Storage before transformation.
Uses httpx for Storage API calls instead of the Supabase Python client.
"""

import hashlib
import json
from datetime import date
from typing import Any, Optional, Tuple

import httpx

from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SOURCE, SKIP_BLOB_STORAGE


class BlobStorageUnavailable(Exception):
    """Raised when blob storage is unavailable (503) or skipped."""
    pass


class BlobStorage:
    """Handles raw payload storage in Supabase Storage."""

    BUCKET_NAME = "raw-payloads"

    def __init__(self):
        self.storage_url = f"{SUPABASE_URL}/storage/v1"
        self.headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        }
        self.client = httpx.Client(headers=self.headers, timeout=30.0)
        self._skip_storage = SKIP_BLOB_STORAGE
        self._storage_unavailable = False  # Set to True on 503 errors

    @property
    def is_available(self) -> bool:
        """Check if blob storage is available and enabled."""
        return not self._skip_storage and not self._storage_unavailable

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
    ) -> Tuple[Optional[str], bool]:
        """
        Store raw JSON payload to blob storage.

        Args:
            user_id: User ID
            data_type: Type of data
            target_date: Date of the data
            external_id: External ID from source
            data: Raw data to store

        Returns:
            Tuple of (storage key path or None, success boolean)
            Returns (key, True) on success
            Returns (key, False) if storage was skipped or unavailable
        """
        key = self._generate_key(user_id, data_type, target_date, external_id, data)

        # Skip storage if configured or previously detected as unavailable
        if self._skip_storage:
            return (key, False)

        if self._storage_unavailable:
            return (key, False)

        # Convert to JSON bytes
        json_bytes = json.dumps(data, indent=2, default=str).encode("utf-8")

        # Upload to storage (upsert mode)
        url = f"{self.storage_url}/object/{self.BUCKET_NAME}/{key}"
        headers = {
            **self.headers,
            "Content-Type": "application/json",
            "x-upsert": "true",
        }

        try:
            response = self.client.post(url, content=json_bytes, headers=headers)
            response.raise_for_status()
            return (key, True)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 503:
                # Storage service unavailable - mark as unavailable and continue
                self._storage_unavailable = True
                return (key, False)
            # Re-raise other HTTP errors
            raise

    def get_raw_payload(self, key: str) -> dict[str, Any]:
        """
        Retrieve raw JSON payload from blob storage.

        Args:
            key: Storage key path

        Returns:
            Parsed JSON data
        """
        url = f"{self.storage_url}/object/{self.BUCKET_NAME}/{key}"
        response = self.client.get(url)
        response.raise_for_status()
        return response.json()

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
            # Try to get file info using HEAD request
            url = f"{self.storage_url}/object/{self.BUCKET_NAME}/{key}"
            response = self.client.head(url)
            return response.status_code == 200
        except Exception:
            return False
