from fastapi import APIRouter, Depends, Query, HTTPException
from sqlmodel import Session, select
from typing import List, Optional
from uuid import UUID
from database import get_session
from models import Major, Course, Lecturer, MaterialType, User, CourseLecturer
from utils.auth_utils import get_verified_user

router = APIRouter(tags=["Catalog"])

def sanitize_like(value: str) -> str:
    """Escape SQL LIKE wildcard characters."""
    return value.replace("%", r"\%").replace("_", r"\_")

@router.get("/api/v1/years")
def get_years():
    """Returns static academic years for the frontend dropdowns/MyPath."""
    return [
        {"id": "1", "label": "Freshman (Year 1)"},
        {"id": "2", "label": "Sophomore (Year 2)"},
        {"id": "3", "label": "Junior (Year 3)"},
        {"id": "4", "label": "Senior (Year 4)"}
    ]

@router.get("/api/v1/semesters")
def get_semesters():
    """Returns static semesters for the frontend dropdowns/MyPath."""
    return [
        {"id": "fall", "label": "Fall Semester"},
        {"id": "spring", "label": "Spring Semester"},
        {"id": "summer", "label": "Summer Semester"}
    ]

@router.get("/api/v1/lecturers")
def get_lecturers(
    course_id: Optional[UUID] = Query(None),
    session: Session = Depends(get_session),
):
    if course_id:
        statement = (
            select(Lecturer)
            .join(CourseLecturer, CourseLecturer.lecturer_id == Lecturer.id)
            .where(CourseLecturer.course_id == course_id)
        )
    else:
        statement = select(Lecturer)
    return session.exec(statement).all()

@router.get("/api/v1/majors", response_model=List[Major])
def list_majors(
    session: Session = Depends(get_session)
):
    return session.exec(select(Major)).all()

@router.get("/api/v1/types", response_model=List[MaterialType])
def list_material_types(
    session: Session = Depends(get_session) 
):
    return session.exec(select(MaterialType)).all()

@router.get("/api/v1/courses", response_model=List[Course])
def search_courses(
    major_id: Optional[UUID] = None,
    year_id: Optional[int] = None,
    query: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_verified_user)
):
    # Start with a base query
    statement = select(Course)

    # Apply filters if provided
    if major_id:
        statement = statement.where(Course.major_id == major_id)
    if year_id:
        statement = statement.where(Course.year_id == year_id)
    if query:
        safe_query = sanitize_like(query)
        # Search by both name and code (case-insensitive)
        statement = statement.where(
            (Course.name.ilike(f"%{safe_query}%")) | (Course.code.ilike(f"%{safe_query}%"))
        )

    results = session.exec(statement).all()
    return results

@router.get("/api/v1/courses/{course_id}")
def get_single_course(
    course_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_verified_user)
):
    """Fetches a single course by its ID."""
    course = session.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course
