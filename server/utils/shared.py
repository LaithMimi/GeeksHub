import os
from google.cloud import storage

# Single shared GCS client — used by both files.py and admin.py
storage_client = storage.Client()
BUCKET_NAME = os.getenv("BUCKET_NAME")

def get_bucket():
    """Returns the GCS bucket instance."""
    return storage_client.bucket(BUCKET_NAME)


def get_badge_tier(points: int) -> str:
    """Returns the badge tier based on total points. Single source of truth."""
    if points > 1000:
        return "Gold"
    if points > 500:
        return "Silver"
    return "Bronze"
