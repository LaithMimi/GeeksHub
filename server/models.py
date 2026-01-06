import re
from typing import Optional, Self
from uuid import UUID, uuid4
from datetime import datetime, timezone
from sqlmodel import SQLModel, Field
from pydantic import BaseModel, field_validator, model_validator

# User Identity
class User(SQLModel, table=True):
    __tablename__ = "users"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    auth0_id: str = Field(unique=True, index=True)
    email: str = Field(unique=True)
    display_name: str
    role: str = "STUDENT" 
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Academic Catalog
class Major(SQLModel, table=True):
    __tablename__ = "majors"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(unique=True)
    slug: str = Field(unique=True)

class Course(SQLModel, table=True):
    __tablename__ = "courses"
    id: str = Field(primary_key=True) # e.g. 'cs101'
    code: str = Field(index=True, unique=True)
    name: str
    major_id: UUID = Field(foreign_key="major.id")
    year_id: int # 1, 2, 3, 4
    semester: int

# Reference Data
class MaterialType(SQLModel, table=True):
    __tablename__ = "material_types"
    id: str = Field(primary_key=True) # e.g. 'slides'
    display_name: str

# Community Contributions
class FileRequest(SQLModel, table=True):
    __tablename__ = "file_requests"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="user.id")
    course_id: str = Field(foreign_key="course.id")
    type_id: str = Field(foreign_key="material_types.id")
    title: str
    lecturer: str = Field(index=True)
    storage_path: str
    status: str = "PENDING"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# This is what the frontend sends to the API
class FileUploadCreate(BaseModel):
    course_id: str
    type_id: str
    title: str
    lecturer: str
    # We will handle the actual file binary via Google Cloud Storage later

class UserSignUp(BaseModel):
    email: str
    username: str
    password: str
    password_confirm: str

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
        return v

    # 2. Model Validator: Checks if the two passwords match
    # We use mode='after' so this runs AFTER the individual fields are validated
    @model_validator(mode='after')
    def passwords_match(self) -> Self:
        if self.password != self.password_confirm:
            raise ValueError('Passwords do not match')
        return self    