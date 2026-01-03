from fastapi import FastAPI, Depends
from contextlib import asynccontextmanager
from sqlmodel import Session, select
from typing import List

from database import get_session, init_db
from models import Major

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Everything here runs ON STARTUP
    print("Starting up: Initializing Neon Database...")
    init_db()
    
    yield  # The app runs while it's "yielding"
    
    # Everything here runs ON SHUTDOWN
    print("Shutting down: Cleaning up resources...")

# Initialize FastAPI with the lifespan handler
app = FastAPI(
    title="GeeksHub API",
    lifespan=lifespan
)

@app.get("/health")
def health_check():
    return {"status": "online"}

@app.get("/api/v1/majors", response_model=List[Major])
def list_majors(session: Session = Depends(get_session)):
    statement = select(Major)
    results = session.exec(statement)
    return results.all()