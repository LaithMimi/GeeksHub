#!/usr/bin/env bash
# Boot the GeeksHub FastAPI backend on Railway.
#
# Railway has no committed secret files. If a GCP service-account key is
# provided as JSON in $GCP_KEY_JSON, materialize it to a file so that
# google-cloud-storage / google-cloud-vision can read it via the standard
# GOOGLE_APPLICATION_CREDENTIALS path. main.py keeps this value as-is when it
# is already absolute.
set -euo pipefail

if [ -n "${GCP_KEY_JSON:-}" ]; then
  printf '%s' "$GCP_KEY_JSON" > /tmp/gcp_key.json
  export GOOGLE_APPLICATION_CREDENTIALS=/tmp/gcp_key.json
fi

# --app-dir puts server/ on sys.path so `main:app` and its `import database`
# / `import routers` resolve. $PORT is provided by Railway.
exec uvicorn main:app --app-dir server --host 0.0.0.0 --port "${PORT:-8000}"
