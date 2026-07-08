import os
import sys

# Force UTF-8 stdout/stderr. Windows consoles default to the cp1252 codepage,
# which can't encode Hebrew/non-Latin characters in course names or filenames —
# any print() containing one crashes the process (this killed embed_single /
# embed_batch mid-flight, silently dropping chunking for approved files).
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import logging
import traceback
from pathlib import Path
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Depends, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from sqlmodel import Session, select
from contextlib import asynccontextmanager
from database import get_session, init_db
from routers import auth, catalog, files, admin, gamification, activity, viewer, ai, tasks, settings, pinned_courses, notifications, directory

limiter = Limiter(key_func=get_remote_address)
# Resolve GCP key path relative to this file so it works from any CWD
_server_dir = Path(__file__).parent
_gcp_cred = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "gcp_key.json")
if not Path(_gcp_cred).is_absolute():
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(_server_dir / _gcp_cred)


# --- App Setup & Lifespan ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Starting up: Initializing Neon Database...")
    init_db()
    yield 
    print("Shutting down...")

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

app = FastAPI(title="GeeksHub API", lifespan=lifespan)

# slowapi wiring: without the registered exception handler, a tripped
# @limiter.limit decorator surfaces as an unstyled error instead of a clean 429.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

logger = logging.getLogger("geekshub")


# Catch-all safety net: any exception a route forgot to handle would otherwise
# bubble up as a bare 500. We log the full traceback server-side (for us) and
# return a calm, generic message to the user — never the raw exception, SQL,
# or stack trace. Handlers registered for HTTPException / RequestValidationError
# still run first, so intentional 4xx responses keep their specific messages.
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error(
        "Unhandled error on %s %s: %s\n%s",
        request.method,
        request.url.path,
        exc,
        "".join(traceback.format_exception(type(exc), exc, exc.__traceback__)),
    )
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Something went wrong on our end. This is on us — please try again in a moment.",
        },
    )

app.add_middleware(SecurityHeadersMiddleware)

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")],
    allow_credentials=True,   
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Cookie"], 
)

# --- Include All Routers ---
app.include_router(auth.router)
app.include_router(catalog.router)
app.include_router(files.router)
app.include_router(admin.router)
app.include_router(gamification.router)
app.include_router(activity.router)
app.include_router(viewer.router)
app.include_router(ai.router)
app.include_router(tasks.router)
app.include_router(settings.router)
app.include_router(pinned_courses.router)
app.include_router(notifications.router)
app.include_router(directory.router)

# --- Base System Routes ---
@app.get("/api/v1/health", tags=["System"])
def health_check(session: Session = Depends(get_session)):
    try:
        session.exec(select(1)).first()
        return {"status": "online", "database": "connected"}
    except Exception:
        return {"status": "online", "database": "disconnected"}
