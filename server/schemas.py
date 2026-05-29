import re
from typing import List, Optional, Self
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, field_validator, model_validator

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
    totalPages: int = 10 # Default fallback if frontend doesn't send it

class ViewerSessionEndPayload(BaseModel):
    session_id: UUID

class ViewerHeartbeatPayload(BaseModel):
    session_id: UUID
    visited_pages: List[int] = [] # List of page numbers the user has visited in this interval
    total_pages: int = 1
    active_seconds_to_add: int = 10 # Assume the heartbeat fires every 10 seconds

class NotePayload(BaseModel):
    content: str

class AIChatRequest(BaseModel):
    fileId: UUID               # The file they are currently reading (camelCase to match frontend)
    message: str
    history: list["ChatMessage"] = []  # Conversation history for multi-turn context

class ChatMessage(BaseModel):
    """One message in the conversation history sent by the frontend."""
    role: str       # "user" or "assistant"
    content: str

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
    language: Optional[str] = None
    defaultMajorId: Optional[str] = None
    defaultYearId: Optional[int] = None
    notifyNewMaterials: Optional[bool] = None
    notifyAdminUpdates: Optional[bool] = None
    reduceMotion: Optional[bool] = None
    compactMode: Optional[bool] = None


# --- Tasks Payloads ---
class TaskCreate(BaseModel):
    title: str
    date: str                  # "YYYY-MM-DD"
    priority: str = "normal"   # "normal" | "high" | "urgent"
    startHour: float = 12.0
    duration: float = 1.0

class TaskPatch(BaseModel):
    title: Optional[str] = None
    date: Optional[str] = None
    priority: Optional[str] = None
    startHour: Optional[float] = None
    duration: Optional[float] = None
    completed: Optional[bool] = None

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
