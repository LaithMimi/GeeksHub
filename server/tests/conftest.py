



"""
Pytest fixtures for the GeeksHub P1 test suite (STD → STR execution).

SAFETY: this conftest hard-codes DATABASE_URL to the disposable local
pgvector container (localhost:55432) BEFORE any server module is imported.
database.py's load_dotenv() does not override pre-set env vars, so the
production Neon URL in server/.env is never used. A guard fixture aborts
the whole session if the engine somehow points anywhere else.

External boundaries mocked (never called for real):
  - Google Cloud Storage  → google.cloud.storage.Client is a MagicMock
  - Auth0                 → routers.auth.get_auth0_admin / GetToken patched per-test
  - Gemini                → embed/background tasks stubbed per-test
"""
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock

SERVER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_DIR))

TEST_DATABASE_URL = "postgresql+psycopg2://postgres:testpass@localhost:55432/geekshub_test"

# --- Environment must be set BEFORE importing any server module ---
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["AUTH0_DOMAIN"] = "geekshub-test.invalid"
os.environ["AUTH0_AUDIENCE"] = "https://geekshub-test-api"
os.environ["AUTH0_M2M_ID"] = "test-m2m-id"
os.environ["AUTH0_M2M_SECRET"] = "test-m2m-secret"
os.environ["BUCKET_NAME"] = "geekshub-test-bucket"
os.environ["GEMINI_API_KEY"] = "test-gemini-key"
os.environ["ENVIRONMENT"] = "development"

# --- Neutralize GCS before utils.shared instantiates its module-level client ---
import google.cloud.storage as _gcs  # noqa: E402
_gcs.Client = MagicMock(name="MockGCSClientClass")

import pytest  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlmodel import Session, SQLModel  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import database  # noqa: E402
from main import app  # noqa: E402
from models import User, Major, Course, Lecturer, MaterialType  # noqa: E402
from utils.auth_utils import get_verified_user  # noqa: E402
from routers.auth import limiter as auth_limiter  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _database():
    """Create the pgvector extension + all tables once; refuse non-test DBs."""
    if "localhost:55432" not in str(database.engine.url):
        pytest.exit(
            f"SAFETY ABORT: engine points at {database.engine.url!r}, "
            "not the disposable test container.", returncode=3,
        )
    with database.engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()
    SQLModel.metadata.create_all(database.engine)
    yield


@pytest.fixture(autouse=True)
def _clean_db(_database):
    """Truncate every table before each test — full isolation, keeps schema."""
    tables = ", ".join(f'"{t.name}"' for t in SQLModel.metadata.sorted_tables)
    with database.engine.connect() as conn:
        conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
        conn.commit()
    yield


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    """Each test starts with fresh rate-limit counters (in-memory storage)."""
    auth_limiter.reset()
    yield
    app.dependency_overrides.clear()


@pytest.fixture()
def client():
    # raise_server_exceptions=False: a 500 comes back as a response we can
    # assert on (and honestly report), instead of crashing the test.
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture()
def db():
    with Session(database.engine) as session:
        yield session


class Seed:
    """Plain IDs (not ORM objects) so tests never trip detached-instance issues."""
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


@pytest.fixture()
def seed(db):
    major = Major(name="Software Engineering", slug="software-engineering")
    other_major = Major(name="Industrial Engineering", slug="industrial-engineering")
    db.add(major); db.add(other_major); db.commit()
    db.refresh(major); db.refresh(other_major)

    course = Course(code="SE101", name="Intro to SE", major_id=major.id, year_id=1, semester=1)
    other_course = Course(code="IE101", name="Intro to IE", major_id=other_major.id, year_id=1, semester=1)
    lecturer = Lecturer(name="Dr. Test Lecturer")
    mtype = MaterialType(display_name="Lecture Slides")
    db.add(course); db.add(other_course); db.add(lecturer); db.add(mtype); db.commit()
    db.refresh(course); db.refresh(other_course); db.refresh(lecturer); db.refresh(mtype)

    student_a = User(auth0_id="auth0|student-a", email="student.a@post.jce.ac.il",
                     name="Student A", role="STUDENT", major_id=major.id)
    student_b = User(auth0_id="auth0|student-b", email="student.b@post.jce.ac.il",
                     name="Student B", role="STUDENT", major_id=major.id)
    moderator = User(auth0_id="auth0|moderator", email="mod@post.jce.ac.il",
                     name="Mod User", role="MODERATOR", major_id=major.id)
    admin = User(auth0_id="auth0|admin", email="admin@post.jce.ac.il",
                 name="Admin User", role="ADMIN", major_id=major.id)
    for u in (student_a, student_b, moderator, admin):
        db.add(u)
    db.commit()
    for u in (student_a, student_b, moderator, admin):
        db.refresh(u)

    return Seed(
        major_id=major.id, other_major_id=other_major.id,
        course_id=course.id, other_course_id=other_course.id,
        lecturer_id=lecturer.id, type_id=mtype.id,
        student_a_id=student_a.id, student_b_id=student_b.id,
        moderator_id=moderator.id, admin_id=admin.id,
    )


@pytest.fixture()
def as_user():
    """Authenticate the TestClient as a seeded user (bypasses Auth0 JWT only —
    role checks in get_admin_user/get_moderator_user still run for real)."""
    def _impersonate(user_id):
        def _override():
            with Session(database.engine) as s:
                return s.get(User, user_id)
        app.dependency_overrides[get_verified_user] = _override
    yield _impersonate
    app.dependency_overrides.clear()
