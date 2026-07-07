from datetime import datetime, timezone
from uuid import UUID
from typing import List
from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select, func
from database import get_session
from models import User, UserRecentFile, Material, UserCourseActivity, PointsTransaction, Course, FileViewingSession
from schemas import RecentFileResponse
from utils.auth_utils import get_verified_user
from utils.shared import get_badge_tier

router = APIRouter(tags=["User Activity Dashboard"])


@router.get("/api/v1/me/recent-files", response_model=List[RecentFileResponse])
def get_recent_files(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_verified_user)
):
    """Returns the user's 10 most recently viewed files."""
    # We join with the Material table so we can send back the actual file title!
    statement = (
        select(UserRecentFile, Material)
        .join(Material, UserRecentFile.file_id == Material.id)
        .where(UserRecentFile.user_id == current_user.id)
        .order_by(UserRecentFile.viewed_at.desc())
        .limit(10)
    )
    results = session.exec(statement).all()
    
    return [
        RecentFileResponse(
            id=recent.file_id, 
            title=material.title, 
            courseId=material.course_id, 
            viewedAt=recent.viewed_at
        ) 
        for recent, material in results
    ]

@router.get("/api/v1/me/activity/summary")
def get_activity_summary(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_verified_user)
):
    """Aggregates user stats for the dashboard overview."""
    # Total study time = active seconds tracked by the file-viewer heartbeat.
    # (UserPlatformSession.active_seconds is never incremented, so it always read 0.)
    time_statement = select(func.sum(FileViewingSession.active_seconds)).where(FileViewingSession.user_id == current_user.id)
    total_seconds = session.exec(time_statement).first() or 0
    
    # Count how many files they've completed
    files_statement = select(func.sum(UserCourseActivity.files_completed)).where(UserCourseActivity.user_id == current_user.id)
    completed_files = session.exec(files_statement).first() or 0

    # Per-course activity (with course names) for the dashboard / profile lists
    activity_rows = session.exec(
        select(UserCourseActivity, Course)
        .join(Course, UserCourseActivity.course_id == Course.id)
        .where(UserCourseActivity.user_id == current_user.id)
    ).all()
    course_activity = [
        {
            "courseId": ca.course_id,
            "courseName": course.name,
            "status": ca.status,
            "filesCompleted": ca.files_completed,
            "totalFiles": ca.total_files,
        }
        for ca, course in activity_rows
    ]
    courses_engaged = len(course_activity)

    # Most recent XP transactions
    txns = session.exec(
        select(PointsTransaction)
        .where(PointsTransaction.user_id == current_user.id)
        .order_by(PointsTransaction.created_at.desc())
        .limit(5)
    ).all()
    recent_transactions = [
        {"id": t.id, "action": t.action, "points": t.amount, "createdAt": t.created_at}
        for t in txns
    ]

    return {
        "totalPoints": current_user.total_points,
        "badgeTier": get_badge_tier(current_user.total_points),
        "totalStudyMinutes": total_seconds // 60,
        "filesCompleted": completed_files,
        "coursesEngaged": courses_engaged,
        "recentTransactions": recent_transactions,
        "courseActivity": course_activity,
    }

@router.post("/api/v1/me/recent-files/{file_id}")
def add_recent_file(
    file_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_verified_user)
):
    """Logs that a user just opened a file so it appears on their dashboard."""
    # 1. Check if the file actually exists
    material = session.get(Material, file_id)
    if not material:
        raise HTTPException(status_code=404, detail="File not found")
        
    # 2. Check if they already have this in their recent list
    statement = select(UserRecentFile).where(UserRecentFile.user_id == current_user.id, UserRecentFile.file_id == file_id)
    recent = session.exec(statement).first()
    
    if recent:
        # If it's already there, just bump the timestamp to NOW
        recent.viewed_at = datetime.now(timezone.utc)
    else:
        # If it's their first time viewing it, create a new record
        recent = UserRecentFile(user_id=current_user.id, file_id=file_id)
        session.add(recent)

    # Mark the course as "exploring" so it counts toward Courses Active as soon as a
    # file is opened, instead of only once viewer_heartbeat crosses the 85% completion
    # threshold. Never downgrade a course already "engaged"/"completed".
    activity = session.get(UserCourseActivity, (current_user.id, material.course_id))
    if not activity:
        session.add(UserCourseActivity(
            user_id=current_user.id,
            course_id=material.course_id,
            status="exploring",
        ))

    session.commit()
    return {"message": "Recent file logged"}

