from typing import Optional
from uuid import UUID, uuid4
from datetime import datetime, timezone
from sqlmodel import Relationship, SQLModel, Field, UniqueConstraint
from sqlalchemy import Column, JSON, Index
from pgvector.sqlalchemy import Vector
from typing import List, Dict, Any

# --- Database Models ---

class User(SQLModel, table=True):
    """
    Represents a user in the system.
    Users can be students or have other roles, and are linked to a major.
    """
    __tablename__ = "users"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    auth0_id: str = Field(index=True, unique=True) # Unique identifier from Auth0 for external authentication
    email: str = Field(index=True, unique=True) # User's email, must be unique
    name: str # User's full name
    role: str = Field(default="STUDENT") # Default role is student
    major_id: Optional[UUID] = Field(default=None, foreign_key="majors.id", index=True) # Foreign key linking users to their selected major
    total_points: int = Field(default=0, index=True) # Total reputation points accumulated by the user
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc)) # Timestamp of user creation

class Major(SQLModel, table=True):
    """
    Represents an academic major offered by the institution.
    """
    __tablename__ = "majors"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(unique=True) # Full name of the major (e.g., "Computer Science")
    slug: str = Field(unique=True) # URL-friendly identifier for the major (e.g., "computer-science")

class Course(SQLModel, table=True):
    """
    Represents a specific course within a major.
    """
    __tablename__ = "courses"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    code: str = Field(index=True, unique=True) # Course code (e.g., "CS101")
    name: str # Full name of the course (e.g., "Introduction to Programming")
    major_id: UUID = Field(foreign_key="majors.id", index=True) # Foreign key linking to the major this course belongs to
    year_id: int # Academic year the course is typically offered (e.g., 1 for freshman year)
    semester: int # Semester the course is typically offered (e.g., 1 for Fall, 2 for Spring)

class Lecturer(SQLModel, table=True):
    """
    Represents a lecturer or professor associated with courses and materials.
    """
    __tablename__ = "lecturers"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(index=True, unique=True) # Full name of the lecturer (e.g., "Dr. Jane Smith")

class MaterialType(SQLModel, table=True):
    """
    Defines different types of study materials (e.g., 'slides', 'exam', 'notes').
    """
    __tablename__ = "material_types"
    id: UUID = Field(default_factory=uuid4, primary_key=True) # unique identifier for the material type
    display_name: str # User-friendly name for the material type (e.g., "Lecture Slides")

# approved files
class Material(SQLModel, table=True):
    __tablename__ = "materials"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    title: str
    academic_year: int #e.g., 1, 2, 3, or 4
    material_year: int # The year the material is relevant to (e.g., 2020 for "Midterm 2020")
    course_id: UUID = Field(foreign_key="courses.id", index=True)
    lecturer_id: UUID = Field(foreign_key="lecturers.id", index=True)
    type_id: UUID = Field(foreign_key="material_types.id", index=True)
    uploader_id: UUID = Field(foreign_key="users.id") # Keep track of who gets the credit!
    notes: str | None = None
    
    # This will be the REAL Google Cloud Storage URL
    file_url: str 
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Community Contributions
class FileRequest(SQLModel, table=True):
    """
    Represents a user's request to upload a file, awaiting moderation.
    """
    __tablename__ = "file_requests"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", index=True) # User who submitted the request
    course_id: UUID = Field(foreign_key="courses.id") # Course the requested file is for
    type_id: UUID = Field(foreign_key="material_types.id") # Type of material being requested
    title: str # Proposed title for the file
    academic_year: int # e.g., 1, 2, 3, or 4
    material_year: int # e.g., 2020 for "Midterm 2020"
    file_url: str # Temporary GCS path - URL to the uploaded file awaiting approval
    lecturer_id: UUID = Field(foreign_key="lecturers.id") # Lecturer associated with the material
    status: str = Field(default="pending", index=True) # Current status of the request (e.g., PENDING, APPROVED, REJECTED)
    notes: str | None = None # Optional field for moderators to provide feedback on the request
    admin_note: str | None = None # Private notes only visible to admins
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc)) # Timestamp of request submission
    lecturer: Lecturer| None = Relationship()

class PointsTransaction(SQLModel, table=True):
    __tablename__ = "points_transactions"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    amount: int # e.g., +10
    action: str # e.g., "upload_approval"
    reason: str # e.g., "File Approved: Midterm 2018"
    request_id: UUID | None = Field(default=None, foreign_key="file_requests.id", index=True) # To prevent double-awarding XP
    source_id: str | None = Field(default=None, unique=True, index=True) # Unique string for non-request events (e.g., 'daily_login:2026-03-19')
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # This prevents double-awarding XP for the exact same file request!
    __table_args__ = (
        UniqueConstraint("request_id", "action", name="uq_request_action"),
    )

class UserRecentFile(SQLModel, table=True):
    __tablename__ = "user_recent_files"
    # Using a composite primary key so a user only has ONE recent entry per file
    user_id: UUID = Field(foreign_key="users.id", primary_key=True)
    file_id: UUID = Field(foreign_key="materials.id", primary_key=True) 
    viewed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)

class UserPlatformSession(SQLModel, table=True):
    __tablename__ = "user_platform_sessions"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    active_seconds: int = Field(default=0)
    intervals_awarded: int = Field(default=0)

class UserCourseActivity(SQLModel, table=True):
    __tablename__ = "user_course_activities"
    user_id: UUID = Field(foreign_key="users.id", primary_key=True)
    course_id: UUID = Field(foreign_key="courses.id", primary_key=True)
    status: str = Field(default="not_started") # not_started, exploring, engaged, completed
    files_completed: int = Field(default=0)
    total_files: int = Field(default=0)

class FileViewingSession(SQLModel, table=True):
    __tablename__ = "file_viewing_sessions"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    file_id: UUID = Field(foreign_key="materials.id")
    course_id: UUID = Field(foreign_key="courses.id")
    
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    active_seconds: int = Field(default=0)
    required_active_seconds: int = Field(default=300) # Our computed target time
    completion_score: float = Field(default=0.0)
    is_complete: bool = Field(default=False)

class UserNote(SQLModel, table=True):
    __tablename__ = "user_notes"
    # Composite primary key: A user only has ONE note document per file
    user_id: UUID = Field(foreign_key="users.id", primary_key=True)
    file_id: UUID = Field(foreign_key="materials.id", primary_key=True)
    content: str
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_logs"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)
    actor_id: UUID = Field(foreign_key="users.id", index=True)
    actor_name: str
    action: str = Field(index=True) # approve, reject, bulk_approve, bulk_reject, undo_approve, undo_reject
    target_type: str # e.g. "file_request"
    target_ids: List[str] = Field(default=[], sa_column=Column(JSON))
    meta_data: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))

# RAG (Retrieval Augmented Generation)
class MaterialChunk(SQLModel, table=True):
    __tablename__ = "material_chunks"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    material_id: UUID = Field(foreign_key="materials.id")
    content: str
    # gemini-embedding-001 truncated to 1536 dims (fits under pgvector HNSW 2000-dim limit)
    embedding: list[float] = Field(sa_column=Column(Vector(1536))) 
    page_number: int | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index(
            "hnsw_index_for_material_chunks", 
            "embedding", 
            postgresql_using="hnsw", 
            postgresql_with={"m": 16, "ef_construction": 64}, 
            postgresql_ops={"embedding": "vector_cosine_ops"}
        ),
    )

class UserNotification(SQLModel, table=True):
    __tablename__ = "user_notifications"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    title: str
    message: str
    read: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)


class PinnedCourse(SQLModel, table=True):
    __tablename__ = "pinned_courses"

    user_id: UUID = Field(foreign_key="users.id", primary_key=True)
    course_id: UUID = Field(foreign_key="courses.id", primary_key=True)
    pinned_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserSettings(SQLModel, table=True):
    """One row per user — created on first GET with defaults."""
    __tablename__ = "user_settings"

    user_id: UUID = Field(foreign_key="users.id", primary_key=True)
    language: str = Field(default="en")
    default_major_id: Optional[UUID] = Field(default=None)
    default_year_id: Optional[int] = Field(default=None)
    notify_new_materials: bool = Field(default=False)
    notify_admin_updates: bool = Field(default=False)
    reduce_motion: bool = Field(default=False)
    compact_mode: bool = Field(default=False)


# Tasks
class UserTask(SQLModel, table=True):
    """Personal learning-plan tasks created by a student."""
    __tablename__ = "user_tasks"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    title: str
    date: str  # stored as "YYYY-MM-DD" — keeps it simple, no TZ issues
    start_hour: float = Field(default=12.0)  # 0–23, supports 0.5 steps
    duration: float = Field(default=1.0)     # hours
    priority: str = Field(default="normal")  # "normal" | "high" | "urgent"
    completed: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_user_tasks_user_date", "user_id", "date"),
    )