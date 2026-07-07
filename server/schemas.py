import re
from typing import List, Literal, Optional, Self
from uuid import UUID
from datetime import date, datetime
from pydantic import BaseModel, Field, field_validator, model_validator

# --- Auth Payloads ---
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
    remember_me: bool = False

class ForgotPassword(BaseModel):
    email: str 

# --- File Request Payloads ---
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
    course_id: UUID
    course_name: str
    lecturer_name: str
    material_id: UUID | None = None
    points_awarded: int
    created_at: datetime
    admin_note: str | None = None

# --- ADMIN PAYLOADS ---
class BulkActionPayload(BaseModel):
    request_ids: List[UUID]

class AdminRejectPayload(BaseModel):
    note: str | None = None

class BulkRejectPayload(BaseModel):
    request_ids: List[UUID]
    reason: str | None = None

# --- Gamification & Tracking Payloads ---
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

class RecentFileResponse(BaseModel):
    id: UUID
    title: str
    courseId: UUID
    viewedAt: datetime

class ViewerSessionStartPayload(BaseModel):
    file_id: UUID

class ViewerSessionEndPayload(BaseModel):
    session_id: UUID

class ViewerHeartbeatPayload(BaseModel):
    session_id: UUID
    visited_pages: List[int] = []
    active_seconds_to_add: int = 10

class NotePayload(BaseModel):
    content: str = Field(max_length=50_000)

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)

class AIChatRequest(BaseModel):
    fileId: UUID
    message: str = Field(max_length=2000)
    history: list[ChatMessage] = Field(default=[], max_length=20)

# --- Notification Payloads ---
class NotificationResponse(BaseModel):
    id: UUID
    title: str
    message: str
    read: bool
    createdAt: datetime

    class Config:
        from_attributes = True


# --- Settings Payloads ---
class SettingsResponse(BaseModel):
    language: str
    defaultMajorId: Optional[str]
    defaultYearId: Optional[int]
    notifyNewMaterials: bool
    notifyAdminUpdates: bool
    reduceMotion: bool
    compactMode: bool

class SettingsPatch(BaseModel):
    language: Optional[Literal["en", "he", "ar"]] = None
    defaultMajorId: Optional[str] = None
    defaultYearId: Optional[int] = Field(default=None, ge=1, le=4)
    notifyNewMaterials: Optional[bool] = None
    notifyAdminUpdates: Optional[bool] = None
    reduceMotion: Optional[bool] = None
    compactMode: Optional[bool] = None


# --- Moderator Payloads ---
# NOTE: request bodies use camelCase to match the frontend convention
# (the apiClient sends camelCase and converts snake_case responses back).
class ModeratorUserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    majorId: Optional[UUID] = None
    role: Optional[Literal["STUDENT", "MODERATOR", "ADMIN"]] = None

class LecturerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)

class LecturerUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)

class CourseCreate(BaseModel):
    code: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=1, max_length=200)
    majorId: UUID
    yearId: int = Field(ge=1, le=4)
    semester: int = Field(ge=1, le=3)
    lecturerIds: List[UUID] = Field(min_length=1)

    @field_validator("code", "name", mode="before")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        stripped = v.strip() if isinstance(v, str) else v
        if isinstance(stripped, str) and not stripped:
            raise ValueError("Field must not be blank")
        return stripped

    @field_validator("lecturerIds", mode="before")
    @classmethod
    def deduplicate_lecturers(cls, v: list) -> list:
        seen: set = set()
        unique: list = []
        for lid in v:
            if lid not in seen:
                seen.add(lid)
                unique.append(lid)
        return unique

class CourseUpdate(BaseModel):
    code: Optional[str] = Field(default=None, min_length=1, max_length=40)
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    majorId: Optional[UUID] = None
    yearId: Optional[int] = Field(default=None, ge=1, le=4)
    semester: Optional[int] = Field(default=None, ge=1, le=3)
    lecturerIds: Optional[List[UUID]] = Field(default=None, min_length=1)

    @field_validator("code", "name", mode="before")
    @classmethod
    def strip_whitespace(cls, v: str | None) -> str | None:
        if v is None:
            return v
        stripped = v.strip() if isinstance(v, str) else v
        if isinstance(stripped, str) and not stripped:
            raise ValueError("Field must not be blank")
        return stripped

    @field_validator("lecturerIds", mode="before")
    @classmethod
    def deduplicate_lecturers(cls, v: list | None) -> list | None:
        if v is None:
            return v
        seen: set = set()
        unique: list = []
        for lid in v:
            if lid not in seen:
                seen.add(lid)
                unique.append(lid)
        return unique

class MajorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)

class MajorUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


# --- Material Request Payloads ---
class MaterialRequestCreate(BaseModel):
    typeId: Optional[UUID] = None  # None = request any material for the course


# --- Tasks Payloads ---
class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    date: str
    priority: Literal["normal", "high", "urgent"] = "normal"
    startHour: float = Field(default=12.0, ge=0, le=23.5)
    duration: float = Field(default=1.0, gt=0, le=12)

    @field_validator("date")
    @classmethod
    def valid_date(cls, v: str) -> str:
        date.fromisoformat(v)
        return v

class TaskPatch(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    date: Optional[str] = None
    priority: Optional[Literal["normal", "high", "urgent"]] = None
    startHour: Optional[float] = Field(default=None, ge=0, le=23.5)
    duration: Optional[float] = Field(default=None, gt=0, le=12)
    completed: Optional[bool] = None

    @field_validator("date")
    @classmethod
    def valid_date(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            date.fromisoformat(v)
        return v

class TaskResponse(BaseModel):
    id: UUID
    title: str
    date: str
    startHour: float
    duration: float
    priority: str
    completed: bool
    createdAt: str

    class Config:
        from_attributes = True
