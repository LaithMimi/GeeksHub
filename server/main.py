import os
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI,Depends
from sqlmodel import Session, select
from contextlib import asynccontextmanager
from database import get_session, init_db
from routers import auth, catalog, files, admin, gamification, activity, viewer, ai, tasks, settings, pinned_courses, notifications


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

app = FastAPI(title="GeeksHub API", lifespan=lifespan)

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")],
    allow_credentials=True,   
    allow_methods=["*"],  
    allow_headers=["*"],  
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

# --- Base System Routes ---
@app.get("/api/v1/health", tags=["System"])
def health_check(session: Session = Depends(get_session)):
    try:
        session.exec(select(1)).first()
        return {"status": "online", "database": "connected"}
    except Exception:
        return {"status": "online", "database": "disconnected"}
