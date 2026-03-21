#!/usr/bin/env python3
"""
Update the GARMIN_TOKENS_BASE64 GitHub secret with fresh tokens.

Called as a post-sync step in the GitHub Actions workflow.
Requires GITHUB_TOKEN (or GH_PAT) and GITHUB_REPOSITORY env vars.

Uses the GitHub API to encrypt and update the repository secret.
"""

import base64
import json
import os
import sys
from pathlib import Path

try:
    from nacl import encoding, public
    HAS_NACL = True
except ImportError:
    HAS_NACL = False

TOKEN_DIR = Path(__file__).parent / ".garmin_tokens"


def encrypt_secret(public_key: str, secret_value: str) -> str:
    """Encrypt a secret using the repo's public key (libsodium sealed box)."""
    if not HAS_NACL:
        raise RuntimeError("PyNaCl not installed — cannot encrypt secrets")
    pk = public.PublicKey(public_key.encode("utf-8"), encoding.Base64Encoder())
    sealed_box = public.SealedBox(pk)
    encrypted = sealed_box.encrypt(secret_value.encode("utf-8"))
    return base64.b64encode(encrypted).decode("utf-8")


def main():
    # Check for required env vars
    token = os.environ.get("GH_PAT") or os.environ.get("GITHUB_TOKEN")
    repo = os.environ.get("GITHUB_REPOSITORY")

    if not token or not repo:
        print("Skipping secret update: GH_PAT/GITHUB_TOKEN or GITHUB_REPOSITORY not set")
        sys.exit(0)

    if not HAS_NACL:
        print("Skipping secret update: PyNaCl not installed (pip install pynacl)")
        sys.exit(0)

    # Build token bundle
    oauth1_path = TOKEN_DIR / "oauth1_token.json"
    oauth2_path = TOKEN_DIR / "oauth2_token.json"

    if not oauth1_path.exists() or not oauth2_path.exists():
        print("Skipping secret update: no tokens to export")
        sys.exit(0)

    bundle = {
        "oauth1": json.loads(oauth1_path.read_text()),
        "oauth2": json.loads(oauth2_path.read_text()),
    }
    secret_value = base64.b64encode(json.dumps(bundle).encode()).decode()

    # Get repo public key for encryption
    import httpx

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    pk_resp = httpx.get(
        f"https://api.github.com/repos/{repo}/actions/secrets/public-key",
        headers=headers,
    )
    if pk_resp.status_code != 200:
        print(f"Failed to get repo public key: {pk_resp.status_code} {pk_resp.text}")
        sys.exit(0)  # Non-fatal

    pk_data = pk_resp.json()
    encrypted = encrypt_secret(pk_data["key"], secret_value)

    # Update the secret
    put_resp = httpx.put(
        f"https://api.github.com/repos/{repo}/actions/secrets/GARMIN_TOKENS_BASE64",
        headers=headers,
        json={
            "encrypted_value": encrypted,
            "key_id": pk_data["key_id"],
        },
    )

    if put_resp.status_code in (201, 204):
        print("Updated GARMIN_TOKENS_BASE64 GitHub secret with fresh tokens")
    else:
        print(f"Failed to update secret: {put_resp.status_code} {put_resp.text}")
        # Non-fatal — the Actions cache is the primary token persistence


if __name__ == "__main__":
    main()
