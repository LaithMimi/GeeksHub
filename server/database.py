import os
from pathlib import Path
from sqlmodel import create_engine, Session, SQLModel
from dotenv import load_dotenv


# Load the Neon connection string from the .env file next to this script
load_dotenv(Path(__file__).parent / ".env")
DATABASE_URL = os.getenv("DATABASE_URL")

# The Engine is the "manager" of the connection
# echo=True to see the SQL commands in your console
engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=3,       # Base connections per Uvicorn worker
    max_overflow=2,    # Burst connections per worker (3+2 = 5 max per worker)
    pool_recycle=300,  # Reconnect every 5 min (Neon drops idle connections)
)

#  This function provides a session for FastAPI routes to use
def get_session():
    with Session(engine) as session:
        yield session

#  This function creates the tables in Neon if they don't exist yet
def init_db():
    SQLModel.metadata.create_all(engine)