import os
from google.cloud import storage

# Single shared GCS client — used by both files.py and admin.py
storage_client = storage.Client()
BUCKET_NAME = os.getenv("BUCKET_NAME")

def get_bucket():
    """Returns the GCS bucket instance."""
    return storage_client.bucket(BUCKET_NAME)


def get_badge_tier(points: int) -> str:
    """Badge tier from total points. Single source of truth.

    Returns lowercase tiers matching the frontend `BadgeTier` union
    ("diamond" | "gold" | "silver" | "bronze" | "newcomer").
    """
    if points >= 5000:
        return "diamond"
    if points >= 1000:
        return "gold"
    if points >= 500:
        return "silver"
    if points > 0:
        return "bronze"
    return "newcomer"
