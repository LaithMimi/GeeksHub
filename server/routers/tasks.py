from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlmodel import Session, select
from database import get_session
from models import User, UserTask
from schemas import TaskCreate, TaskPatch, TaskResponse
from utils.auth_utils import get_verified_user

router = APIRouter(tags=["Tasks"])

def _to_response(task: UserTask) -> TaskResponse:
    return TaskResponse(
        id=task.id,
        title=task.title,
        date=task.date,
        startHour=task.start_hour,
        duration=task.duration,
        priority=task.priority,
        completed=task.completed,
        createdAt=task.created_at.isoformat(),
    )

@router.get("/api/v1/me/tasks")
def list_tasks(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_verified_user),
):
    """Return all tasks for the current user, ordered by date then start_hour."""
    statement = (
        select(UserTask)
        .where(UserTask.user_id == current_user.id)
        .order_by(UserTask.date, UserTask.start_hour)
    )
    tasks = session.exec(statement).all()
    return [_to_response(t) for t in tasks]

@router.post("/api/v1/me/tasks", status_code=201)
def create_task(
    payload: TaskCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_verified_user),
):
    """Create a new task for the current user."""
    task = UserTask(
        user_id=current_user.id,
        title=payload.title.strip(),
        date=payload.date,
        start_hour=payload.startHour,
        duration=payload.duration,
        priority=payload.priority,
    )
    session.add(task)
    session.commit()
    session.refresh(task)
    return _to_response(task)

@router.patch("/api/v1/me/tasks/{task_id}")
def update_task(
    task_id: UUID,
    payload: TaskPatch,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_verified_user),
):
    """Toggle completion or edit any field on the user's own task."""
    task = session.exec(
        select(UserTask)
        .where(UserTask.id == task_id, UserTask.user_id == current_user.id)
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    if payload.title is not None:
        task.title = payload.title.strip()
    if payload.date is not None:
        task.date = payload.date
    if payload.priority is not None:
        task.priority = payload.priority
    if payload.startHour is not None:
        task.start_hour = payload.startHour
    if payload.duration is not None:
        task.duration = payload.duration
    if payload.completed is not None:
        task.completed = payload.completed

    session.add(task)
    session.commit()
    session.refresh(task)
    return _to_response(task)

@router.delete("/api/v1/me/tasks/{task_id}", status_code=204)
def delete_task(
    task_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_verified_user),
):
    """Delete a task. 404 if it doesn't belong to the current user."""
    task = session.exec(
        select(UserTask)
        .where(UserTask.id == task_id, UserTask.user_id == current_user.id)
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    session.delete(task)
    session.commit()
    return Response(status_code=204)
