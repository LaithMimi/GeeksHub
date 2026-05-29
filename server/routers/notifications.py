from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func
from database import get_session
from models import User, UserNotification
from schemas import NotificationResponse
from utils.auth_utils import get_verified_user

router = APIRouter(tags=["Notifications"])


@router.get("/api/v1/me/notifications", response_model=list[NotificationResponse])
def get_notifications(
    session: Session = Depends(get_session),
    user: User = Depends(get_verified_user),
):
    rows = session.exec(
        select(UserNotification)
        .where(UserNotification.user_id == user.id)
        .order_by(UserNotification.created_at.desc())
        .limit(50)
    ).all()
    return [NotificationResponse(
        id=n.id, title=n.title, message=n.message,
        read=n.read, createdAt=n.created_at,
    ) for n in rows]


@router.get("/api/v1/me/notifications/unread-count")
def get_unread_count(
    session: Session = Depends(get_session),
    user: User = Depends(get_verified_user),
):
    count = session.exec(
        select(func.count(UserNotification.id))
        .where(UserNotification.user_id == user.id, UserNotification.read == False)  # noqa: E712
    ).one()
    return {"count": count}


@router.patch("/api/v1/me/notifications/{notification_id}/read")
def mark_as_read(
    notification_id: UUID,
    session: Session = Depends(get_session),
    user: User = Depends(get_verified_user),
):
    notif = session.get(UserNotification, notification_id)
    if not notif or notif.user_id != user.id:
        raise HTTPException(status_code=404, detail="Notification not found.")
    notif.read = True
    session.add(notif)
    session.commit()
    return {"message": "Marked as read."}


@router.patch("/api/v1/me/notifications/read-all")
def mark_all_as_read(
    session: Session = Depends(get_session),
    user: User = Depends(get_verified_user),
):
    rows = session.exec(
        select(UserNotification)
        .where(UserNotification.user_id == user.id, UserNotification.read == False)  # noqa: E712
    ).all()
    for n in rows:
        n.read = True
        session.add(n)
    session.commit()
    return {"message": f"Marked {len(rows)} notifications as read."}
