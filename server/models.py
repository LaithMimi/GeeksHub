import re
from typing import List, Optional, Self
from uuid import UUID, uuid4
from datetime import datetime, timezone
from sqlmodel import Relationship, SQLModel, Field, UniqueConstraint
from pydantic import BaseModel, field_validator, model_validator

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
    major_id: Optional[UUID] = Field(default=None, foreign_key="majors.id") # Foreign key linking users to their selected major
    total_points: int = Field(default=0) # Total reputation points accumulated by the user
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
    major_id: UUID = Field(foreign_key="majors.id") # Foreign key linking to the major this course belongs to
    year_id: int # Academic year the course is typically offered (e.g., 1 for freshman year)
    semester: int # Semester the course is typically offered (e.g., 1 for Fall, 2 for Spring)

class Lecturer(SQLModel, table=True):
    """
    Represents a lecturer or professor associated with courses and materials.
    """
    __tablename__ = "lecturers"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    name: str = Field(index=True) # Full name of the lecturer (e.g., "Dr. Jane Smith")
    email: str | None = Field(default=None, unique=True, index=True) # Optional email for the lecturer

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
    course_id: UUID = Field(foreign_key="courses.id")
    lecturer_id: UUID = Field(foreign_key="lecturers.id")
    type_id: UUID = Field(foreign_key="material_types.id")
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
    user_id: UUID = Field(foreign_key="users.id") # User who submitted the request
    course_id: UUID = Field(foreign_key="courses.id") # Course the requested file is for
    type_id: UUID = Field(foreign_key="material_types.id") # Type of material being requested
    title: str # Proposed title for the file
    academic_year: int # e.g., 1, 2, 3, or 4
    material_year: int # e.g., 2020 for "Midterm 2020"
    file_url: str # Temporary GCS path - URL to the uploaded file awaiting approval
    lecturer_id: UUID = Field(foreign_key="lecturers.id") # Lecturer associated with the material
    status: str = "pending" # Current status of the request (e.g., PENDING, APPROVED, REJECTED)
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
    request_id: UUID | None = Field(default=None, foreign_key="file_requests.id") # To prevent double-awarding XP
    source_id: str | None = Field(default=None, unique=True, index=True) # Unique string for non-request events (e.g., 'daily_login:2026-03-19')
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # This prevents double-awarding XP for the exact same file request!
    __table_args__ = (
        UniqueConstraint("request_id", "action", name="uq_request_action"),
    )

# Used for the Upload/Request endpoint
class FileRequestCreate(BaseModel):
    """
    Pydantic model for creating a new file request from the frontend.
    """
    course_id: UUID
    type_id: UUID
    title: str
    lecturer_id: UUID

class FileRequestEnriched(BaseModel):
    id: UUID
    title: str
    status: str
    academic_year: int
    material_year: int
    course_name: str
    lecturer_name: str
    material_id: UUID | None = None
    points_awarded: int
    created_at: datetime
    admin_note: str | None = None

class UserSignUp(BaseModel):
    """
    Pydantic model for user registration, including password validation.
    """
    username: str
    email: str
    password: str
    password_confirm: str
    major_id: UUID 

    # 1. Field Validator: Checks the strength of the password
    @field_validator('password')
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not re.search(r"[A-Z]", v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r"[0-9]", v):
            raise ValueError('Password must contain at least one number')
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            raise ValueError('Password must contain at least one special character')
        return v

    # 2. Model Validator: Checks if the two passwords match
    # We use mode='after' so this runs AFTER the individual fields are validated
    @model_validator(mode='after')
    def passwords_match(self) -> Self:
        if self.password != self.password_confirm:
            raise ValueError('Passwords do not match')
        return self    
    
class UserSignIn(BaseModel):
    email: str
    password: str   

class ForgotPassword(BaseModel):
    email: str 

# --- REPUTATION SYSTEM PAYLOADS ---

class TransactionResponse(BaseModel):
    id: UUID
    amount: int
    action: str
    reason: str
    created_at: datetime

class MyReputationResponse(BaseModel):
    userId: UUID
    totalPoints: int
    badge: str
    transactions: List[TransactionResponse]

class LeaderboardEntry(BaseModel):
    userId: UUID
    name: str
    totalPoints: int
    badge: str

# --- ADMIN PAYLOADS ---

class BulkActionPayload(BaseModel):
    request_ids: List[UUID]

class AdminRejectPayload(BaseModel):
    note: str | None = None

class BulkRejectPayload(BaseModel):
    request_ids: List[UUID]
    reason: str | None = None

# --- TRACKING & GAMIFICATION TABLES ---

class UserRecentFile(SQLModel, table=True):
    __tablename__ = "user_recent_files"
    # Using a composite primary key so a user only has ONE recent entry per file
    user_id: UUID = Field(foreign_key="users.id", primary_key=True)
    file_id: UUID = Field(foreign_key="materials.id", primary_key=True) 
    viewed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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

class SessionStartResponse(BaseModel):
    sessionId: UUID

class RecentFileResponse(BaseModel):
    file_id: UUID
    title: str
    course_id: UUID
    viewed_at: datetime