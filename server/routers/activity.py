from datetime import datetime, timezone
from uuid import UUID
from typing import List
from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select, func
from database import get_session
from models import User, UserPlatformSession, UserRecentFile, Material, UserCourseActivity
from schemas import SessionStartResponse, RecentFileResponse
from utils.auth_utils import get_verified_user

router = APIRouter(tags=["User Activity Dashboard"])

@router.post("/api/v1/me/session/start", response_model=SessionStartResponse)
def start_platform_session(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_verified_user)
):
    """Starts a new study session to track active time on the platform."""
    new_session = UserPlatformSession(user_id=current_user.id)
    session.add(new_session)
    session.commit()
    session.refresh(new_session)
    return {"sessionId": new_session.id}

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
    # Calculate total study time across all sessions
    time_statement = select(func.sum(UserPlatformSession.active_seconds)).where(UserPlatformSession.user_id == current_user.id)
    total_seconds = session.exec(time_statement).first() or 0
    
    # Count how many files they've completed
    files_statement = select(func.sum(UserCourseActivity.files_completed)).where(UserCourseActivity.user_id == current_user.id)
    completed_files = session.exec(files_statement).first() or 0

    return {
        "totalPoints": current_user.total_points,
        "totalStudyMinutes": total_seconds // 60,
        "filesCompleted": completed_files,
        "coursesEngaged": len(session.exec(select(UserCourseActivity).where(UserCourseActivity.user_id == current_user.id)).all())
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
        
    session.commit()
    return {"message": "Recent file logged"}

