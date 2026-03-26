from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select
from database import get_session
from models import User, Material, UserNote, FileViewingSession, PointsTransaction, UserCourseActivity
from schemas import NotePayload, ViewerSessionStartPayload, ViewerHeartbeatPayload, ViewerSessionEndPayload
from utils.auth_utils import get_verified_user

router = APIRouter(tags=["Document Viewer & Study Tools"])

@router.get("/api/v1/me/notes")
def get_notes(
    fileId: UUID,  # Note the capital 'I' here to match Laith's query parameter!
    session: Session = Depends(get_session),
    current_user: User = Depends(get_verified_user)
):
    """Fetches the user's private scratchpad for a specific file."""
    statement = select(UserNote).where(UserNote.user_id == current_user.id, UserNote.file_id == fileId)
    note = session.exec(statement).first()
    
    # If they haven't written any notes yet, just return an empty string so the frontend doesn't crash
    if not note:
        return {"content": ""}
        
    return {"content": note.content}

@router.post("/api/v1/me/notes")
def save_notes(
    fileId: UUID, 
    payload: NotePayload,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_verified_user)
):
    """Saves the user's private scratchpad for a specific file."""
    statement = select(UserNote).where(UserNote.user_id == current_user.id, UserNote.file_id == fileId)
    note = session.exec(statement).first()
    
    if note:
        note.content = payload.content
        note.updated_at = datetime.now(timezone.utc)
    else:
        note = UserNote(user_id=current_user.id, file_id=fileId, content=payload.content)
        session.add(note)
        
    session.commit()
    return {"message": "Note saved successfully"}

@router.post("/api/v1/me/viewer/session-start")
def start_viewer_session(
    payload: ViewerSessionStartPayload,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_verified_user)
):
    """Starts a stopwatch when a user opens a specific material to read."""
    material = session.get(Material, payload.file_id)
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    # Formula from frontend spec: Pages * 45 seconds * 0.60 effort threshold
    target_seconds = int(payload.totalPages * 45 * 0.60)

    view_session = FileViewingSession(
        user_id=current_user.id,
        file_id=material.id,
        course_id=material.course_id,
        required_active_seconds=target_seconds
    )
    
    session.add(view_session)
    session.commit()
    session.refresh(view_session)
    
    return {"sessionId": view_session.id}

@router.post("/api/v1/me/viewer/heartbeat")
def viewer_heartbeat(
    payload: ViewerHeartbeatPayload,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_verified_user)
):
    """Adds time to the stopwatch and awards XP if they hit 85% completion."""
    
    # 1. Find the stopwatch session
    view_session = session.get(FileViewingSession, payload.session_id)
    if not view_session or view_session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Viewing session not found")

    # If they already finished it earlier, don't do the math again
    if view_session.is_complete:
        return {"message": "Already complete", "score": 1.0, "isComplete": True}

    # 2. Add the time the frontend told us to add
    view_session.active_seconds += payload.active_seconds_to_add

    # 3. Calculate the score based on Laith's formula (Time x Pages)
    time_ratio = min(view_session.active_seconds / max(view_session.required_active_seconds, 1), 1.0)
    page_ratio = min((len(payload.visited_pages) / max(payload.total_pages, 1)), 1.0)
    
    view_session.completion_score = time_ratio * page_ratio

    # 4. THE MAGIC MOMENT: Did they hit 85%?
    if view_session.completion_score >= 0.85:
        view_session.is_complete = True
        
        # A. Write the receipt to the Ledger (+10 XP)
        reward = PointsTransaction(
            user_id=current_user.id,
            amount=10,
            action="file_completed",
            reason="Completed studying a file",
            source_id=f"view_{view_session.id}" # Prevents cheating/double-awarding!
        )
        session.add(reward)
        
        # B. Update the fast User Cache
        current_user.total_points += 10
        session.add(current_user)
        
        # C. Update the Course Progress Bar Cache
        activity = session.get(UserCourseActivity, (current_user.id, view_session.course_id))
        if not activity:
            activity = UserCourseActivity(user_id=current_user.id, course_id=view_session.course_id)
            session.add(activity)
            
        activity.files_completed += 1
        if activity.status == "not_started":
            activity.status = "exploring"

    session.commit()
    
    return {
        "message": "Heartbeat registered", 
        "activeSeconds": view_session.active_seconds,
        "score": view_session.completion_score,
        "isComplete": view_session.is_complete
    }

@router.post("/api/v1/me/viewer/session-end")
def end_viewer_session(
    payload: ViewerSessionEndPayload,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_verified_user)
):
    """Finalizes the reading session and returns the total score to the frontend."""
    
    view_session = session.get(FileViewingSession, payload.session_id)
    if not view_session or view_session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Viewing session not found")

    # Here you could add an "ended_at" timestamp to the database if you wanted, 
    # but for now, we just return the final stats so the UI can show a summary screen!
    
    return {
        "message": "Session ended successfully",
        "activeSeconds": view_session.active_seconds,
        "score": view_session.completion_score,
        "isComplete": view_session.is_complete
    }
