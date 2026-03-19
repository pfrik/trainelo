#!/usr/bin/env python3
"""
Export local Garmin OAuth tokens as a base64 string for GitHub Secrets.

Usage:
    python export_tokens.py

Outputs a single base64 string. Copy it and set it as the
GARMIN_TOKENS_BASE64 secret in your GitHub repository.
"""

import base64
import json
import sys
from pathlib import Path

TOKEN_DIR = Path(__file__).parent / ".garmin_tokens"


def main():
    oauth1_path = TOKEN_DIR / "oauth1_token.json"
    oauth2_path = TOKEN_DIR / "oauth2_token.json"

    if not oauth1_path.exists() or not oauth2_path.exists():
        print("Error: No local tokens found at", TOKEN_DIR)
        print("Run a local sync first to generate tokens:")
        print("  cd scripts/garmin-sync && python sync.py --days 1")
        sys.exit(1)

    bundle = {
        "oauth1": json.loads(oauth1_path.read_text()),
        "oauth2": json.loads(oauth2_path.read_text()),
    }

    encoded = base64.b64encode(json.dumps(bundle).encode()).decode()

    print("=" * 60)
    print("Copy the value below and set it as a GitHub Secret:")
    print("  Name:  GARMIN_TOKENS_BASE64")
    print("=" * 60)
    print(encoded)
    print("=" * 60)
    print(f"Token age: oauth1 from {oauth1_path.stat().st_mtime:.0f}")
    print("Done. Paste the value above into:")
    print("  GitHub > Settings > Secrets > Actions > GARMIN_TOKENS_BASE64")


if __name__ == "__main__":
    main()
