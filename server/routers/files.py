import os
import random
import string
import datetime
import re
from uuid import UUID
from sqlmodel import func
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query, Form, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
from database import get_session
from models import Material, FileRequest, Course, Lecturer, User, PointsTransaction, MaterialRequest, MaterialType, UserSettings, UserNotification, AuditLog
from schemas import FileRequestEnriched, MaterialRequestCreate, MaterialUpdatePayload
from utils.auth_utils import get_verified_user, get_admin_user
from utils.upload_utils import validate_uploaded_file
from utils.shared import storage_client, BUCKET_NAME

router = APIRouter(tags=["Files & Requests"])

async def upload_to_gcs(file: UploadFile, destination_blob_name: str):
    """
    Uploads a file to the Google Cloud Storage bucket.
    Runs the blocking GCS call in a thread pool so it doesn't freeze the event loop.
    """
    import asyncio

    try:
        bucket = storage_client.bucket(BUCKET_NAME)
        blob = bucket.blob(destination_blob_name)
        file.file.seek(0)
        
        # Run the blocking upload in a background thread
        await asyncio.get_running_loop().run_in_executor(
            None,
            lambda: blob.upload_from_file(file.file, content_type=file.content_type)
        )
        
        return destination_blob_name
        
    except Exception as e:
        print(f"FATAL GCS ERROR: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload file to cloud storage.")

def sanitize_like(value: str) -> str:
    """Escape SQL LIKE wildcard characters."""
    return value.replace("%", r"\%").replace("_", r"\_")

# --- Endpoints ---

@router.get("/api/v1/files")
def list_files(
    course_id: Optional[UUID] = Query(None),
    type_id: Optional[UUID] = Query(None),
    lecturer_id: Optional[UUID] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_verified_user)
):
    """
    Returns a paginated list of approved materials.
    Leaves the downloadUrl blank so the frontend fetches it only when clicked.
    """
    statement = select(Material)

    # Apply all the filters
    if course_id:
        statement = statement.where(Material.course_id == course_id)
    if type_id:
        statement = statement.where(Material.type_id == type_id)
    if lecturer_id:
        statement = statement.where(Material.lecturer_id == lecturer_id)
    if search:
        safe_search = sanitize_like(search)
        statement = statement.where(Material.title.ilike(f"%{safe_search}%"))

    statement = statement.offset((page - 1) * page_size).limit(page_size)

    materials = session.exec(statement).all()

    frontend_friendly_list = []
    for mat in materials:
        mat_dict = mat.model_dump()
        mat_dict["courseId"] = mat.course_id     
        mat_dict["typeId"] = mat.type_id         
        mat_dict["lecturerId"] = mat.lecturer_id 
        frontend_friendly_list.append(mat_dict)

    return frontend_friendly_list

@router.get("/api/v1/files/{file_id}")
def get_single_file(
    file_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_verified_user)
):
    """
    Returns a single file's metadata AND generates a secure 15-minute 
    Google Cloud Storage download link for the PDF viewer.
    """
    material = session.get(Material, file_id)
    if not material:
        raise HTTPException(status_code=404, detail="File not found")

    # Generate a Signed URL for the frontend PDF viewer
    try:
        bucket = storage_client.bucket(BUCKET_NAME)
        blob = bucket.blob(material.file_url) # Our real GCS path saved during approval
        
        download_url = blob.generate_signed_url(
            version="v4",
            expiration=datetime.timedelta(minutes=15),
            method="GET",
        )
    except Exception as e:
        print(f"GCS Error: {e}")
        download_url = None # Fallback if GCS isn't wired up locally yet

    # We merge the database object with the newly generated secure URL
    response_data = material.model_dump()
    response_data["downloadUrl"] = download_url
    response_data["courseId"] = material.course_id
    response_data["typeId"] = material.type_id
    response_data["lecturerId"] = material.lecturer_id

    return response_data

@router.get("/api/v1/files/{file_id}/stream")
def stream_file(
    file_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_verified_user),
):
    material = session.get(Material, file_id)
    if not material:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        blob = storage_client.bucket(BUCKET_NAME).blob(material.file_url)
        if not blob.exists():
            raise HTTPException(status_code=404, detail="File not found in storage.")
        def iter_blob():
            with blob.open("rb") as f:
                while chunk := f.read(256 * 1024):  # 256 KB chunks
                    yield chunk
        return StreamingResponse(iter_blob(), media_type="application/pdf")
    except HTTPException:
        raise
    except Exception as e:
        print(f"GCS Stream Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to stream file.")

@router.put("/api/v1/files/{file_id}")
def update_file_metadata(
    file_id: UUID,
    payload: MaterialUpdatePayload,
    session: Session = Depends(get_session),
    admin: User = Depends(get_admin_user)
):
    material = session.get(Material, file_id)
    if not material:
        raise HTTPException(status_code=404, detail="File not found")
    
    if payload.title:
        material.title = payload.title
    if payload.courseId:
        material.course_id = payload.courseId
    if payload.lecturerId:
        material.lecturer_id = payload.lecturerId
    if payload.typeId:
        material.type_id = payload.typeId
        
    session.add(material)
    
    # Audit log
    session.add(AuditLog(
        admin_id=admin.id,
        action="Update",
        target_type="Material",
        target_id=str(material.id),
        details=f"Admin {admin.name} updated file metadata.",
        meta_data={"targetName": material.title}
    ))
    
    session.commit()
    session.refresh(material)
    
    response_data = material.model_dump()
    response_data["courseId"] = material.course_id
    response_data["typeId"] = material.type_id
    response_data["lecturerId"] = material.lecturer_id
    return response_data

@router.delete("/api/v1/files/{file_id}")
def delete_file_admin(
    file_id: UUID,
    session: Session = Depends(get_session),
    admin: User = Depends(get_admin_user)
):
    material = session.get(Material, file_id)
    if not material:
        raise HTTPException(status_code=404, detail="File not found")
        
    try:
        bucket = storage_client.bucket(BUCKET_NAME)
        bucket.blob(material.file_url).delete()
    except Exception as e:
        print(f"GCS Delete failed: {e}")
        
    session.delete(material)
    
    # Audit log
    session.add(AuditLog(
        admin_id=admin.id,
        action="Delete",
        target_type="Material",
        target_id=str(file_id),
        details=f"Admin {admin.name} deleted file.",
        meta_data={"targetName": material.title}
    ))
    
    session.commit()
    return {"message": "File deleted successfully"}

@router.get("/api/v1/me/requests", response_model=List[FileRequestEnriched])
def get_my_requests(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_verified_user)
):
    """Enriched student queue — single query with LEFT JOIN for XP."""
    statement = (
        select(FileRequest, Course, Lecturer, PointsTransaction)
        .outerjoin(Course, FileRequest.course_id == Course.id)
        .outerjoin(Lecturer, FileRequest.lecturer_id == Lecturer.id)
        .outerjoin(PointsTransaction, PointsTransaction.request_id == FileRequest.id)
        .where(FileRequest.user_id == current_user.id)
    )
    results = session.exec(statement).all()
    
    enriched_list = []
    for request, course, lecturer, xp in results:
        mat_id = request.id if request.status == "approved" else None
        pts = xp.amount if xp else 0
        
        enriched_list.append(
            FileRequestEnriched(
                id=request.id, title=request.title, status=request.status,
                academic_year=request.academic_year, material_year=request.material_year,
                course_id=request.course_id, course_name=course.name if course else "Unknown Course",
                lecturer_name=lecturer.name if lecturer else "Unknown Lecturer",
                material_id=mat_id, points_awarded=pts, created_at=request.created_at,
                admin_note=request.admin_note
            )
        )
    return enriched_list

@router.post("/api/v1/courses/{course_id}/upload")
async def upload_course_file(
    course_id: UUID,
    # Using Form(...) because we are receiving multipart/form-data (binary files), not JSON!
    title: str = Form(...),
    academic_year: int = Form(...),
    material_year: int = Form(...),
    type_id: UUID = Form(...), 
    lecturer_id: UUID = Form(...),
    notes: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_verified_user),
    session: Session = Depends(get_session)
):
    # 0. RATE LIMIT — max 30 uploads per hour per student (L5 from security audit)
    one_hour_ago = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=1)
    recent_uploads = session.exec(
        select(func.count(FileRequest.id)).where(
            FileRequest.user_id == current_user.id,
            FileRequest.created_at >= one_hour_ago
        )
    ).one()
    if recent_uploads >= 30:
        raise HTTPException(
            status_code=429,
            detail="Upload limit reached. You can submit up to 30 files per hour."
        )

    # 1. THE SECURITY BOUNCER
    # This will throw a 400/413 error if it's a virus, too big, or fake extension
    safe_ext = await validate_uploaded_file(file)

    # 2. FILENAME KEEP ORIGINAL NAME (with a tiny random string to prevent overwrites)
    base_name = re.sub(r'[^\w\-]', '_', os.path.splitext(file.filename)[0])[:100]
    random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=4))
    file_name = f"{base_name}_{random_suffix}{safe_ext}"
    
    # 3. CLOUD ISOLATION (The "Pending" Folder)
    # We save it in a specific 'pending' folder so it doesn't mix with approved files
    storage_path = f"pending_uploads/{file_name}"
    
    # Reset the file pointer after our magic bytes check in validate_uploaded_file
    await file.seek(0) 
    gcs_uri = await upload_to_gcs(file, storage_path)

    # 4. DATABASE INSERTION
    new_request = FileRequest(
        user_id=current_user.id,
        course_id=course_id,
        lecturer_id=lecturer_id,
        type_id=type_id,
        academic_year=academic_year,
        material_year=material_year,
        title=title,
        notes=notes,
        status="pending",
        file_url=gcs_uri # We store where the file lives in the cloud
    )
    
    session.add(new_request)
    session.commit()
    session.refresh(new_request)

    return new_request

@router.post("/api/v1/courses/{course_id}/request-files")
def request_course_files(
    course_id: UUID,
    payload: MaterialRequestCreate,
    current_user: User = Depends(get_verified_user),
    session: Session = Depends(get_session),
):
    """
    A student asks for materials (optionally of a specific type) to be uploaded for a
    course. Notifies the relevant cohort — same major, whose Settings 'default year'
    matches the course's year, who opted into new-material alerts — inviting them to
    upload and earn XP. De-duplicated: only the first open request per (course, type)
    broadcasts, so the cohort can't be spammed.
    """
    course = session.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")

    type_id = payload.typeId
    type_label = "materials"
    if type_id is not None:
        mtype = session.get(MaterialType, type_id)
        if not mtype:
            raise HTTPException(status_code=400, detail="Material type not found.")
        type_label = mtype.display_name

    # De-dupe: if an open request for this (course, type) already exists, don't re-broadcast.
    existing = session.exec(
        select(MaterialRequest).where(
            MaterialRequest.course_id == course_id,
            MaterialRequest.type_id == type_id,
            MaterialRequest.status == "open",
        )
    ).first()
    if existing:
        return {"notified": 0, "already_requested": True}

    session.add(MaterialRequest(
        course_id=course_id,
        type_id=type_id,
        requested_by=current_user.id,
    ))

    # Audience: same major, not the requester, opted in. Notifications are opt-out, so
    # users with no settings row (never opened Settings) are treated as opted-in — hence
    # an OUTER join and IS NULL fallbacks. A null year only matches when no row exists;
    # an explicit notify_new_materials == False excludes deliberate opt-outs.
    recipients = session.exec(
        select(User)
        .join(UserSettings, UserSettings.user_id == User.id, isouter=True)
        .where(
            User.major_id == course.major_id,
            User.id != current_user.id,
            (UserSettings.user_id == None)  # noqa: E711
            | (UserSettings.default_year_id == course.year_id),
            (UserSettings.notify_new_materials == None)  # noqa: E711
            | (UserSettings.notify_new_materials == True),  # noqa: E712
        )
    ).all()

    message = (
        f"A student requested {type_label} for {course.name}. "
        f"Upload yours to help out and earn XP!"
    )
    for u in recipients:
        session.add(UserNotification(
            user_id=u.id,
            title="Materials requested",
            message=message,
        ))

    session.commit()
    return {"notified": len(recipients)}

@router.delete("/api/v1/me/requests/{request_id}")
def withdraw_request(
    request_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_verified_user)
):
    """Allows a student to delete their own pending request."""
    request = session.get(FileRequest, request_id)
    if not request or request.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Request not found.")
    
    if request.status != "pending":
        raise HTTPException(status_code=400, detail="Only pending requests can be withdrawn.")
    
    try:
        bucket = storage_client.bucket(BUCKET_NAME)
        bucket.blob(request.file_url).delete()
    except Exception as e:
        print(f"GCS Delete failed: {e}")

    session.delete(request)
    session.commit()
    return {"message": "Request withdrawn successfully."}

