from typing import Optional
from uuid import UUID, uuid4
from datetime import datetime
from sqlmodel import SQLModel, Field

# 1. User Identity
class User(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    auth0_id: str = Field(unique=True, index=True)
    email: str = Field(unique=True)
    display_name: str
    role: str = "STUDENT" #

# 2. Academic Catalog
class Major(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(unique=True)
    slug: str = Field(unique=True)

class Course(SQLModel, table=True):
    id: str = Field(primary_key=True) # e.g. 'cs101'
    code: str = Field(index=True, unique=True)
    name: str
    major_id: UUID = Field(foreign_key="major.id")
    year_id: int # 1, 2, 3, 4

# 3. Reference Data
class MaterialType(SQLModel, table=True):
    __tablename__ = "material_types"
    id: str = Field(primary_key=True) # e.g. 'slides'
    display_name: str

# 4. Community Contributions
class FileRequest(SQLModel, table=True):
    __tablename__ = "file_requests"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="user.id")
    course_id: str = Field(foreign_key="course.id")
    type_id: str = Field(foreign_key="material_types.id")
    title: str
    storage_path: str
    status: str = "PENDING"
    
    created_at: datetime = Field(default_factory=datetime.utcnow)