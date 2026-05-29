from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlmodel import Session, select
from database import get_session
from models import User, PinnedCourse, Course
from utils.auth_utils import get_verified_user

router = APIRouter(tags=["Pinned Courses"])


@router.get("/api/v1/me/pinned-courses")
def get_pinned_courses(
    session: Session = Depends(get_session),
    user: User = Depends(get_verified_user),
):
    rows = session.exec(
        select(PinnedCourse).where(PinnedCourse.user_id == user.id)
    ).all()
    return [str(r.course_id) for r in rows]


@router.post("/api/v1/me/pinned-courses/{course_id}", status_code=201)
def pin_course(
    course_id: UUID,
    session: Session = Depends(get_session),
    user: User = Depends(get_verified_user),
):
    if not session.get(Course, course_id):
        raise HTTPException(status_code=404, detail="Course not found.")

    existing = session.get(PinnedCourse, (user.id, course_id))
    if existing:
        return {"message": "Already pinned."}

    session.add(PinnedCourse(user_id=user.id, course_id=course_id))
    session.commit()
    return {"message": "Course pinned."}


@router.delete("/api/v1/me/pinned-courses/{course_id}", status_code=204)
def unpin_course(
    course_id: UUID,
    session: Session = Depends(get_session),
    user: User = Depends(get_verified_user),
):
    row = session.get(PinnedCourse, (user.id, course_id))
    if not row:
        raise HTTPException(status_code=404, detail="Course not pinned.")
    session.delete(row)
    session.commit()
    return Response(status_code=204)
