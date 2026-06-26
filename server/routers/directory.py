"""
Directory management.

Exposes /api/v1/directory/* for MODERATOR (and ADMIN) users to manage the platform
directory: users, lecturers, courses, and lecturer<->course assignments. Reuses the
existing CourseLecturer junction model — no new table.
"""

import re
from datetime import datetime, timezone, timedelta
from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlmodel import Session, select, func
from sqlalchemy.exc import IntegrityError

from database import get_session
from models import User, Major, Course, Lecturer, CourseLecturer
from schemas import (
    ModeratorUserUpdate,
    LecturerCreate,
    LecturerUpdate,
    CourseCreate,
    CourseUpdate,
    MajorCreate,
    MajorUpdate,
)
from utils.auth_utils import get_moderator_user

router = APIRouter(prefix="/api/v1/directory", tags=["Directory"])


def sanitize_like(value: str) -> str:
    """Escape SQL LIKE wildcard characters."""
    return value.replace("%", r"\%").replace("_", r"\_")


def slugify(value: str) -> str:
    """URL-friendly slug from a name, e.g. "Software Engineering" -> "software-engineering"."""
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "major"


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@router.get("/stats")
def get_moderator_stats(
    session: Session = Depends(get_session),
    mod: User = Depends(get_moderator_user),
):
    week_start = datetime.now(timezone.utc) - timedelta(days=7)
    return {
        "total_users": session.exec(select(func.count(User.id))).one(),
        "total_lecturers": session.exec(select(func.count(Lecturer.id))).one(),
        "total_courses": session.exec(select(func.count(Course.id))).one(),
        "new_users_this_week": session.exec(
            select(func.count(User.id)).where(User.created_at >= week_start)
        ).one(),
    }


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

@router.get("/users")
def list_users(
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    major_id: Optional[UUID] = Query(None),
    session: Session = Depends(get_session),
    mod: User = Depends(get_moderator_user),
):
    """Returns users with their major name, filterable by search/role/major."""
    statement = select(User, Major).join(
        Major, User.major_id == Major.id, isouter=True
    )
    if search:
        safe = sanitize_like(search)
        statement = statement.where(
            User.name.ilike(f"%{safe}%") | User.email.ilike(f"%{safe}%")
        )
    if role:
        statement = statement.where(User.role == role.upper())
    if major_id:
        statement = statement.where(User.major_id == major_id)

    statement = statement.order_by(User.created_at.desc())
    rows = session.exec(statement).all()
    return [
        {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "major_id": user.major_id,
            "major_name": major.name if major else None,
            "total_points": user.total_points,
            "created_at": user.created_at,
        }
        for user, major in rows
    ]


@router.put("/users/{user_id}")
def update_user(
    user_id: UUID,
    payload: ModeratorUserUpdate,
    session: Session = Depends(get_session),
    mod: User = Depends(get_moderator_user),
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Only ADMINs may grant the ADMIN role or modify an existing admin.
    if mod.role != "ADMIN":
        if payload.role == "ADMIN":
            raise HTTPException(status_code=403, detail="Only an admin can grant the ADMIN role.")
        if user.role == "ADMIN":
            raise HTTPException(status_code=403, detail="Only an admin can modify another admin.")

    if payload.name is not None:
        user.name = payload.name
    # Distinguish "field omitted" (leave unchanged) from "field set to null"
    # (clear the major). A bare `is not None` check makes clearing impossible.
    if "majorId" in payload.model_fields_set:
        if payload.majorId is not None and not session.get(Major, payload.majorId):
            raise HTTPException(status_code=400, detail="Major not found.")
        user.major_id = payload.majorId
    if payload.role is not None:
        user.role = payload.role

    session.add(user)
    session.commit()
    session.refresh(user)
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "major_id": user.major_id,
        "total_points": user.total_points,
        "created_at": user.created_at,
    }


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: UUID,
    session: Session = Depends(get_session),
    mod: User = Depends(get_moderator_user),
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if user.id == mod.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account.")
    if user.role == "ADMIN" and mod.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Only an admin can delete an admin.")

    try:
        session.delete(user)
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=409,
            detail="This user has associated data (uploads, points, activity) and cannot be deleted.",
        )
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Majors
# ---------------------------------------------------------------------------

@router.get("/majors")
def list_majors(
    session: Session = Depends(get_session),
    mod: User = Depends(get_moderator_user),
):
    """All majors with how many courses each contains."""
    rows = session.exec(
        select(Major, func.count(Course.id))
        .join(Course, Course.major_id == Major.id, isouter=True)
        .group_by(Major.id)
        .order_by(Major.name)
    ).all()
    return [
        {"id": major.id, "name": major.name, "slug": major.slug, "course_count": count or 0}
        for major, count in rows
    ]


@router.post("/majors", status_code=201)
def create_major(
    payload: MajorCreate,
    session: Session = Depends(get_session),
    mod: User = Depends(get_moderator_user),
):
    name = payload.name.strip()
    slug = slugify(name)
    clash = session.exec(
        select(Major).where((Major.name == name) | (Major.slug == slug))
    ).first()
    if clash:
        raise HTTPException(status_code=409, detail="A major with that name already exists.")
    major = Major(name=name, slug=slug)
    session.add(major)
    session.commit()
    session.refresh(major)
    return major


@router.put("/majors/{major_id}")
def update_major(
    major_id: UUID,
    payload: MajorUpdate,
    session: Session = Depends(get_session),
    mod: User = Depends(get_moderator_user),
):
    major = session.get(Major, major_id)
    if not major:
        raise HTTPException(status_code=404, detail="Major not found.")
    name = payload.name.strip()
    slug = slugify(name)
    clash = session.exec(
        select(Major).where(
            (Major.name == name) | (Major.slug == slug),
            Major.id != major_id,
        )
    ).first()
    if clash:
        raise HTTPException(status_code=409, detail="A major with that name already exists.")
    major.name = name
    major.slug = slug
    session.add(major)
    session.commit()
    session.refresh(major)
    return major


@router.delete("/majors/{major_id}", status_code=204)
def delete_major(
    major_id: UUID,
    session: Session = Depends(get_session),
    mod: User = Depends(get_moderator_user),
):
    major = session.get(Major, major_id)
    if not major:
        raise HTTPException(status_code=404, detail="Major not found.")
    try:
        session.delete(major)
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=409,
            detail="This major has courses or users and cannot be deleted.",
        )
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Lecturers
# ---------------------------------------------------------------------------

@router.get("/lecturers")
def list_lecturers(
    session: Session = Depends(get_session),
    mod: User = Depends(get_moderator_user),
):
    """All lecturers with how many courses each is assigned to."""
    try:
        rows = session.exec(
            select(Lecturer, func.count(CourseLecturer.course_id))
            .join(CourseLecturer, CourseLecturer.lecturer_id == Lecturer.id, isouter=True)
            .group_by(Lecturer.id)
            .order_by(Lecturer.name)
        ).all()
        return [
            {"id": lec.id, "name": lec.name, "course_count": count or 0}
            for lec, count in rows
        ]
    except Exception as e:
        print("Error fetching lecturers:", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/lecturers", status_code=201)
def create_lecturer(
    payload: LecturerCreate,
    session: Session = Depends(get_session),
    mod: User = Depends(get_moderator_user),
):
    if session.exec(select(Lecturer).where(Lecturer.name == payload.name)).first():
        raise HTTPException(status_code=409, detail="A lecturer with that name already exists.")
    lecturer = Lecturer(name=payload.name)
    session.add(lecturer)
    session.commit()
    session.refresh(lecturer)
    return lecturer


@router.put("/lecturers/{lecturer_id}")
def update_lecturer(
    lecturer_id: UUID,
    payload: LecturerUpdate,
    session: Session = Depends(get_session),
    mod: User = Depends(get_moderator_user),
):
    lecturer = session.get(Lecturer, lecturer_id)
    if not lecturer:
        raise HTTPException(status_code=404, detail="Lecturer not found.")
    clash = session.exec(
        select(Lecturer).where(Lecturer.name == payload.name, Lecturer.id != lecturer_id)
    ).first()
    if clash:
        raise HTTPException(status_code=409, detail="A lecturer with that name already exists.")
    lecturer.name = payload.name
    session.add(lecturer)
    session.commit()
    session.refresh(lecturer)
    return lecturer


@router.delete("/lecturers/{lecturer_id}", status_code=204)
def delete_lecturer(
    lecturer_id: UUID,
    session: Session = Depends(get_session),
    mod: User = Depends(get_moderator_user),
):
    lecturer = session.get(Lecturer, lecturer_id)
    if not lecturer:
        raise HTTPException(status_code=404, detail="Lecturer not found.")

    # Remove junction rows first so the assignment FKs don't block the delete.
    for row in session.exec(
        select(CourseLecturer).where(CourseLecturer.lecturer_id == lecturer_id)
    ).all():
        session.delete(row)

    try:
        session.delete(lecturer)
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=409,
            detail="This lecturer is referenced by materials or requests and cannot be deleted.",
        )
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Lecturer <-> Course assignment (lecturer side)
# ---------------------------------------------------------------------------

@router.get("/lecturers/{lecturer_id}/courses")
def list_lecturer_courses(
    lecturer_id: UUID,
    session: Session = Depends(get_session),
    mod: User = Depends(get_moderator_user),
):
    if not session.get(Lecturer, lecturer_id):
        raise HTTPException(status_code=404, detail="Lecturer not found.")
    return session.exec(
        select(Course)
        .join(CourseLecturer, CourseLecturer.course_id == Course.id)
        .where(CourseLecturer.lecturer_id == lecturer_id)
        .order_by(Course.name)
    ).all()


@router.post("/lecturers/{lecturer_id}/courses/{course_id}", status_code=201)
def assign_course(
    lecturer_id: UUID,
    course_id: UUID,
    session: Session = Depends(get_session),
    mod: User = Depends(get_moderator_user),
):
    if not session.get(Lecturer, lecturer_id):
        raise HTTPException(status_code=404, detail="Lecturer not found.")
    if not session.get(Course, course_id):
        raise HTTPException(status_code=404, detail="Course not found.")
    if session.get(CourseLecturer, (course_id, lecturer_id)):
        return {"message": "Already assigned."}
    session.add(CourseLecturer(course_id=course_id, lecturer_id=lecturer_id))
    session.commit()
    return {"message": "Course assigned."}


@router.delete("/lecturers/{lecturer_id}/courses/{course_id}", status_code=204)
def unassign_course(
    lecturer_id: UUID,
    course_id: UUID,
    session: Session = Depends(get_session),
    mod: User = Depends(get_moderator_user),
):
    row = session.get(CourseLecturer, (course_id, lecturer_id))
    if not row:
        raise HTTPException(status_code=404, detail="Assignment not found.")
    session.delete(row)
    session.commit()
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Courses (writes; reads live in catalog.py)
# ---------------------------------------------------------------------------

@router.post("/courses", status_code=201)
def create_course(
    payload: CourseCreate,
    session: Session = Depends(get_session),
    mod: User = Depends(get_moderator_user),
):
    if not session.get(Major, payload.majorId):
        raise HTTPException(status_code=400, detail="Major not found.")
    if session.exec(select(Course).where(Course.code == payload.code)).first():
        raise HTTPException(status_code=409, detail="A course with that code already exists.")
    course = Course(
        code=payload.code,
        name=payload.name,
        major_id=payload.majorId,
        year_id=payload.yearId,
        semester=payload.semester,
    )
    session.add(course)
    session.commit()
    session.refresh(course)
    return course


@router.put("/courses/{course_id}")
def update_course(
    course_id: UUID,
    payload: CourseUpdate,
    session: Session = Depends(get_session),
    mod: User = Depends(get_moderator_user),
):
    course = session.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")

    if payload.code is not None and payload.code != course.code:
        if session.exec(select(Course).where(Course.code == payload.code)).first():
            raise HTTPException(status_code=409, detail="A course with that code already exists.")
        course.code = payload.code
    if payload.name is not None:
        course.name = payload.name
    if payload.majorId is not None:
        if not session.get(Major, payload.majorId):
            raise HTTPException(status_code=400, detail="Major not found.")
        course.major_id = payload.majorId
    if payload.yearId is not None:
        course.year_id = payload.yearId
    if payload.semester is not None:
        course.semester = payload.semester

    session.add(course)
    session.commit()
    session.refresh(course)
    return course


@router.delete("/courses/{course_id}", status_code=204)
def delete_course(
    course_id: UUID,
    session: Session = Depends(get_session),
    mod: User = Depends(get_moderator_user),
):
    course = session.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")

    # Remove junction rows first.
    for row in session.exec(
        select(CourseLecturer).where(CourseLecturer.course_id == course_id)
    ).all():
        session.delete(row)

    try:
        session.delete(course)
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=409,
            detail="This course has materials or requests and cannot be deleted.",
        )
    return Response(status_code=204)


@router.get("/courses/{course_id}/lecturers")
def list_course_lecturers(
    course_id: UUID,
    session: Session = Depends(get_session),
    mod: User = Depends(get_moderator_user),
):
    if not session.get(Course, course_id):
        raise HTTPException(status_code=404, detail="Course not found.")
    return session.exec(
        select(Lecturer)
        .join(CourseLecturer, CourseLecturer.lecturer_id == Lecturer.id)
        .where(CourseLecturer.course_id == course_id)
        .order_by(Lecturer.name)
    ).all()
