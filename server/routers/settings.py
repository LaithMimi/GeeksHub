from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from database import get_session
from models import User, UserSettings
from schemas import SettingsPatch, SettingsResponse
from utils.auth_utils import get_verified_user

router = APIRouter(tags=["Settings"])

# this function is used to convert the UserSettings model to the SettingsResponse schema,
# which is returned to the client.
def to_response(s: UserSettings) -> SettingsResponse:
    return SettingsResponse(
        language=s.language,
        defaultMajorId=str(s.default_major_id) if s.default_major_id else None,
        defaultYearId=s.default_year_id,
        notifyNewMaterials=s.notify_new_materials,
        notifyAdminUpdates=s.notify_admin_updates,
        reduceMotion=s.reduce_motion,
        compactMode=s.compact_mode,
    )

# this function is used to get the UserSettings for a user, or create a new one if it doesn't exist.
def get_or_create(user_id: UUID, session: Session) -> UserSettings:
    settings = session.get(UserSettings, user_id)
    if not settings:
        settings = UserSettings(user_id=user_id)
        session.add(settings)
        session.commit()
        session.refresh(settings)
    return settings


@router.get("/api/v1/me/settings", response_model=SettingsResponse)
def get_settings(
    session: Session = Depends(get_session),
    user: User = Depends(get_verified_user),
):
    return to_response(get_or_create(user.id, session))


@router.patch("/api/v1/me/settings", response_model=SettingsResponse)
def patch_settings(
    payload: SettingsPatch,
    session: Session = Depends(get_session),
    user: User = Depends(get_verified_user),
):
    settings = get_or_create(user.id, session)

    if payload.language is not None:
        settings.language = payload.language
    if payload.defaultMajorId is not None:
        if payload.defaultMajorId == "none":
            settings.default_major_id = None
        else:
            try:
                settings.default_major_id = UUID(payload.defaultMajorId)
            except ValueError:
                raise HTTPException(status_code=422, detail="Invalid defaultMajorId UUID.")
    if payload.defaultYearId is not None:
        settings.default_year_id = payload.defaultYearId
    if payload.notifyNewMaterials is not None:
        settings.notify_new_materials = payload.notifyNewMaterials
    if payload.notifyAdminUpdates is not None:
        settings.notify_admin_updates = payload.notifyAdminUpdates
    if payload.reduceMotion is not None:
        settings.reduce_motion = payload.reduceMotion
    if payload.compactMode is not None:
        settings.compact_mode = payload.compactMode

    session.add(settings)
    session.commit()
    session.refresh(settings)
    return to_response(settings)
