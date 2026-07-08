import os
import datetime
import traceback
from uuid import UUID
from typing import List, Optional
from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends, Query, Response
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select, func
from sqlalchemy import update, or_
from database import get_session, engine
from models import FileRequest, Course, Material, PointsTransaction, User, AuditLog, Lecturer, MaterialType, UserNotification, MaterialRequest
from schemas import AdminRejectPayload, BulkActionPayload, BulkRejectPayload
from utils.auth_utils import get_admin_user
from utils.shared import storage_client, BUCKET_NAME
from utils.ai_utils import process_and_embed_pdf
from utils.pptx_utils import convert_pptx_to_pdf

router = APIRouter(tags=["Admin Moderation"])

# --- Setup ---
XP_UPLOAD_APPROVAL = 25
XP_REQUESTED_UPLOAD_BONUS = 25  # extra XP when an approved upload fulfills a student request

# ---------------------------------------------------------------------------
# Background embedding helpers
# These functions MUST open their own Session because FastAPI closes the
# request-scoped session before any BackgroundTask runs.
# ---------------------------------------------------------------------------

def embed_single(material_id: str, gcs_path: str) -> None:
    """Downloads one file from GCS and generates Gemini embeddings."""
    print(f"[BG] embed_single started: material={material_id}, path={gcs_path}")
    try:
        print(f"[BG] Downloading from GCS: {gcs_path}")
        blob = storage_client.bucket(BUCKET_NAME).blob(gcs_path)
        file_bytes = blob.download_as_bytes()
        print(f"[BG] Download OK: {len(file_bytes):,} bytes")
        with Session(engine) as bg_session:
            process_and_embed_pdf(file_bytes, material_id, bg_session)
        print(f"[BG] ✅ embed_single complete: {material_id}")
    except Exception as e:
        print(f"[BG] ❌ embed_single FAILED for {material_id}: {type(e).__name__}: {e}")
        traceback.print_exc()


def embed_batch(approved_materials: list[tuple[str, str]]) -> None:
    """Downloads and embeds each file in the approved batch sequentially."""
    print(f"[BG] embed_batch started for {len(approved_materials)} files")
    with Session(engine) as bg_session:
        for material_id, gcs_path in approved_materials:
            print(f"[BG] Processing: material={material_id}, path={gcs_path}")
            try:
                print(f"[BG] Downloading from GCS: {gcs_path}")
                blob = storage_client.bucket(BUCKET_NAME).blob(gcs_path)
                file_bytes = blob.download_as_bytes()
                print(f"[BG] Download OK: {len(file_bytes):,} bytes")
                process_and_embed_pdf(file_bytes, material_id, bg_session)
                print(f"[BG] ✅ embed_batch item complete: {material_id}")
            except Exception as e:
                print(f"[BG] ❌ embed_batch item FAILED for {material_id}: {type(e).__name__}: {e}")
                traceback.print_exc()

# --- Endpoints ---

@router.get("/api/v1/admin/requests")
def list_admin_requests(
    status: Optional[str] = Query(None),
    session: Session = Depends(get_session),
    admin: User = Depends(get_admin_user)
):
    """Returns all file requests with enriched names for the admin moderation UI."""
    statement = (
        select(FileRequest, Course, Lecturer, User, MaterialType)
        .join(Course, FileRequest.course_id == Course.id)
        .join(Lecturer, FileRequest.lecturer_id == Lecturer.id)
        .join(User, FileRequest.user_id == User.id)
        .join(MaterialType, FileRequest.type_id == MaterialType.id)
    )
    if status:
        statement = statement.where(FileRequest.status == status.lower())

    results = session.exec(statement).all()

    return [
        {
            "id": req.id,
            "user_id": req.user_id,
            "uploader_name": uploader.name,
            "course_id": req.course_id,
            "course_name": course.name,
            "lecturer_id": req.lecturer_id,
            "lecturer_name": lecturer.name,
            "type": material_type.display_name,
            "type_id": req.type_id,
            "title": req.title,
            "academic_year": req.academic_year,
            "material_year": req.material_year,
            "status": req.status,
            "notes": req.notes,
            "admin_note": req.admin_note,
            "file_url": req.file_url,
            "created_at": req.created_at,
        }
        for req, course, lecturer, uploader, material_type in results
    ]

@router.post("/api/v1/admin/requests/{request_id}/approve")
def approve_file(
    request_id: UUID,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    admin: User = Depends(get_admin_user)
):
    request = session.get(FileRequest, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found.")

    if request.status == "approved":
        raise HTTPException(status_code=409, detail="Request already approved.")

    course = session.get(Course, request.course_id)
    safe_course_name = course.name.replace(" ", "_")

    filename = request.file_url.split('/')[-1]
    bucket = storage_client.bucket(BUCKET_NAME)

    try:
        if filename.lower().endswith('.pptx'):
            # Convert to PDF: download → convert → upload PDF → delete PPTX
            print(f"[APPROVE] Converting PPTX to PDF: {filename}")
            pptx_bytes = bucket.blob(request.file_url).download_as_bytes()
            pdf_bytes = convert_pptx_to_pdf(pptx_bytes)
            pdf_filename = filename[:-5] + '.pdf'
            final_gcs_path = f"{safe_course_name}/{pdf_filename}"
            bucket.blob(final_gcs_path).upload_from_string(pdf_bytes, content_type='application/pdf')
            bucket.blob(request.file_url).delete()
            print(f"[APPROVE] PPTX converted and stored as PDF: {final_gcs_path}")
        else:
            final_gcs_path = f"{safe_course_name}/{filename}"
            bucket.rename_blob(bucket.blob(request.file_url), final_gcs_path)
    except RuntimeError as e:
        print(f"PPTX conversion failed: {e}")
        raise HTTPException(status_code=500, detail="We couldn't process that presentation file. Please try uploading it again, or convert it to PDF first.")
    except Exception as e:
        print(f"GCS Move failed: {e}")
        raise HTTPException(status_code=500, detail="Cloud storage error.")

    new_material = Material(
        id=request.id,
        title=request.title, academic_year=request.academic_year, material_year=request.material_year, 
        course_id=request.course_id, lecturer_id=request.lecturer_id, type_id=request.type_id,
        uploader_id=request.user_id, notes=request.notes, file_url=final_gcs_path
    )
    session.add(new_material)

    reward = PointsTransaction(
        user_id=request.user_id,
        amount=XP_UPLOAD_APPROVAL,
        action="upload_approval",
        reason=f"File Approved: {request.title}",
        request_id=request.id
    )
    session.add(reward)

    session.exec(
        update(User).where(User.id == request.user_id)
        .values(total_points=User.total_points + XP_UPLOAD_APPROVAL)
    )

    # Bonus XP if this upload fulfills one or more open material requests for the course.
    # A request with type_id IS NULL ("any material") is matched by any upload type.
    open_requests = session.exec(
        select(MaterialRequest).where(
            MaterialRequest.course_id == request.course_id,
            MaterialRequest.status == "open",
            or_(MaterialRequest.type_id == request.type_id, MaterialRequest.type_id == None),  # noqa: E711
        )
    ).all()
    if open_requests:
        # The PointsTransaction (request_id, action) unique constraint keeps this idempotent.
        session.add(PointsTransaction(
            user_id=request.user_id,
            amount=XP_REQUESTED_UPLOAD_BONUS,
            action="requested_upload_bonus",
            reason=f"Fulfilled a file request: {request.title}",
            request_id=request.id,
        ))
        session.exec(
            update(User).where(User.id == request.user_id)
            .values(total_points=User.total_points + XP_REQUESTED_UPLOAD_BONUS)
        )
        fulfilled_at = datetime.datetime.now(datetime.timezone.utc)
        for mr in open_requests:
            mr.status = "fulfilled"
            mr.fulfilled_by_request_id = request.id
            mr.fulfilled_at = fulfilled_at
            session.add(mr)
            if mr.requested_by != request.user_id:
                session.add(UserNotification(
                    user_id=mr.requested_by,
                    title="Your request was filled",
                    message=f"The materials you requested for {course.name} were just added.",
                ))

    request.status = "approved"

    audit = AuditLog(
        actor_id=admin.id,
        actor_name=admin.name,
        action="approve",
        target_type="file_request",
        target_ids=[str(request.id)],
        meta_data={"title": request.title, "filename": filename}
    )
    session.add(audit)

    session.add(UserNotification(
        user_id=request.user_id,
        title="Upload Approved",
        message=f'Your upload "{request.title}" has been approved and is now live.',
    ))

    session.commit()

    # Fire-and-forget: admin gets an instant response; embedding runs in the background.
    # embed_single opens its own Session — the request session is already closed here.
    background_tasks.add_task(embed_single, str(new_material.id), final_gcs_path)

    return {"message": "File approved!"}

@router.post("/api/v1/admin/requests/{request_id}/reject")
def reject_request(
    request_id: UUID,
    payload: AdminRejectPayload, 
    session: Session = Depends(get_session),
    admin: User = Depends(get_admin_user)
):
    request = session.get(FileRequest, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found.")

    # Only pending requests may be rejected. Rejecting an approved one would leave
    # its Material live in the catalog and the XP awarded while the request reads
    # "rejected" — an approved request must go through undo-approve first.
    if request.status != "pending":
        raise HTTPException(
            status_code=409,
            detail=f"Only pending requests can be rejected (current status: {request.status})."
        )

    # MOVE TO TRASH INSTEAD OF DELETING
    filename = request.file_url.split('/')[-1]
    trash_path = f"trash_bin/{filename}"
    
    try:
        bucket = storage_client.bucket(BUCKET_NAME)
        temp_blob = bucket.blob(request.file_url)
        bucket.rename_blob(temp_blob, trash_path)
        
        # Update the database so it knows the new location!
        request.file_url = trash_path 
    except Exception as e:
        print(f"GCS Move to trash failed: {e}")

    request.status = "rejected" 
    if payload and payload.note:
        request.admin_note = payload.note
        
    audit = AuditLog(
        actor_id=admin.id,
        actor_name=admin.name,
        action="reject",
        target_type="file_request",
        target_ids=[str(request.id)],
        meta_data={"title": request.title, "filename": filename, "reason": payload.note if payload and payload.note else ""}
    )
    session.add(audit)

    note_text = f": {payload.note}" if payload and payload.note else ""
    session.add(UserNotification(
        user_id=request.user_id,
        title="Upload Rejected",
        message=f'Your upload "{request.title}" was rejected{note_text}.',
    ))

    session.commit()
    return {"message": "Request rejected and moved to trash for 3 days."}

# Gemini 1.5 free-tier limit: 15 RPM. We embed 1 API call per file,
# so capping at 10 files/minute gives a comfortable safety buffer.
BULK_APPROVE_LIMIT = 10
BULK_REJECT_LIMIT = 10

@router.post("/api/v1/admin/requests/bulk-approve")
def bulk_approve_requests(
    payload: BulkActionPayload,
    response: Response,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    admin: User = Depends(get_admin_user)
):
    """Approves up to 10 files at once (Gemini 1.5 free-tier: 15 RPM).
    
    If you have more files to approve, wait 60 seconds and submit the next batch.
    The response includes a 'Retry-After: 60' header as a hint to the frontend.
    """
    # --- Hard cap: reject batches larger than BULK_APPROVE_LIMIT ---
    if len(payload.request_ids) > BULK_APPROVE_LIMIT:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Bulk approval is limited to {BULK_APPROVE_LIMIT} files at a time "
                f"to stay within Gemini's 15 RPM free-tier limit. "
                f"You sent {len(payload.request_ids)} IDs. "
                f"Please split your selection into batches of {BULK_APPROVE_LIMIT} "
                f"and wait 60 seconds between submissions."
            )
        )

    approved_count = 0
    bucket = storage_client.bucket(BUCKET_NAME)
    approved_materials: list[tuple[str, str]] = []  # (material_id, final_gcs_path)

    # Bulk-fetch all requested records upfront — avoids N+1 round-trips
    all_requests = session.exec(
        select(FileRequest).where(FileRequest.id.in_(payload.request_ids))
    ).all()
    pending_requests = [r for r in all_requests if r.status == "pending"]

    course_ids = {r.course_id for r in pending_requests}
    courses = {
        c.id: c for c in session.exec(select(Course).where(Course.id.in_(course_ids))).all()
    }

    for request in pending_requests:
        course = courses.get(request.course_id)
        if not course:
            continue
        safe_course_name = course.name.replace(" ", "_")

        # MOVE FILE IN GOOGLE CLOUD STORAGE (convert PPTX to PDF if needed)
        filename = request.file_url.split('/')[-1]
        try:
            if filename.lower().endswith('.pptx'):
                print(f"[BULK-APPROVE] Converting PPTX to PDF: {filename}")
                pptx_bytes = bucket.blob(request.file_url).download_as_bytes()
                pdf_bytes = convert_pptx_to_pdf(pptx_bytes)
                pdf_filename = filename[:-5] + '.pdf'
                final_gcs_path = f"{safe_course_name}/{pdf_filename}"
                bucket.blob(final_gcs_path).upload_from_string(pdf_bytes, content_type='application/pdf')
                bucket.blob(request.file_url).delete()
                print(f"[BULK-APPROVE] Converted and stored as PDF: {final_gcs_path}")
            else:
                final_gcs_path = f"{safe_course_name}/{filename}"
                bucket.rename_blob(bucket.blob(request.file_url), final_gcs_path)
        except Exception as e:
            print(f"GCS move/conversion failed for request {request.id}: {e}")
            # If the cloud move or conversion fails, skip — don't award XP for a broken file.
            continue

        # CREATE THE OFFICIAL CATALOG ENTRY
        new_material = Material(
            id=request.id,
            title=request.title, academic_year=request.academic_year, material_year=request.material_year,
            course_id=request.course_id, lecturer_id=request.lecturer_id, type_id=request.type_id,
            uploader_id=request.user_id, notes=request.notes, file_url=final_gcs_path
        )
        session.add(new_material)
        
        # AWARD GAMIFICATION XP
        reward = PointsTransaction(
            user_id=request.user_id,
            amount=XP_UPLOAD_APPROVAL, 
            action="upload_approval",
            reason=f"File Approved: {request.title}",
            request_id=request.id
        )
        session.add(reward)

        # UPDATE THE USER'S TOTAL POINTS
        session.exec(
            update(User).where(User.id == request.user_id)
            .values(total_points=User.total_points + XP_UPLOAD_APPROVAL)
        )
        
        request.status = "approved"
        approved_count += 1
        approved_materials.append((str(new_material.id), final_gcs_path))
        
    if approved_count > 0:
        audit = AuditLog(
            actor_id=admin.id,
            actor_name=admin.name,
            action="bulk_approve",
            target_type="file_request",
            target_ids=[str(req_id) for req_id in payload.request_ids],
            meta_data={"count": approved_count}
        )
        session.add(audit)

    session.commit()

    # Fire-and-forget: register ONE background task for the entire batch.
    # embed_batch opens its own Session and processes files sequentially
    # so we never exceed ~10 RPM even for a full 10-file batch.
    if approved_materials:
        background_tasks.add_task(embed_batch, approved_materials)

    # Tell the frontend: "if you have more files, wait 60 s before the next batch"
    response.headers["Retry-After"] = "60"

    return {"message": f"Successfully approved {approved_count} files!"}

@router.post("/api/v1/admin/requests/bulk-reject")
def bulk_reject_requests(
    payload: BulkRejectPayload,
    session: Session = Depends(get_session),
    admin: User = Depends(get_admin_user)
):
    if len(payload.request_ids) > BULK_REJECT_LIMIT:
        raise HTTPException(
            status_code=422,
            detail=f"Bulk reject is limited to {BULK_REJECT_LIMIT} files at a time. You sent {len(payload.request_ids)} IDs."
        )

    rejected_count = 0
    bucket = storage_client.bucket(BUCKET_NAME)

    # Bulk-fetch all requested records upfront — avoids N+1 round-trips
    all_requests = session.exec(
        select(FileRequest).where(FileRequest.id.in_(payload.request_ids))
    ).all()

    for request in [r for r in all_requests if r.status == "pending"]:
            
        filename = request.file_url.split('/')[-1]
        trash_path = f"trash_bin/{filename}"
        
        try:
            temp_blob = bucket.blob(request.file_url)
            bucket.rename_blob(temp_blob, trash_path)
            request.file_url = trash_path
        except Exception as e:
            print(f"GCS Move failed for {request.id}: {e}")
            
        request.status = "rejected"
        if payload.reason:
            request.admin_note = payload.reason
            
        rejected_count += 1
        
    if rejected_count > 0:
        audit = AuditLog(
            actor_id=admin.id,
            actor_name=admin.name,
            action="bulk_reject",
            target_type="file_request",
            target_ids=[str(req_id) for req_id in payload.request_ids],
            meta_data={"count": rejected_count, "reason": payload.reason if payload.reason else ""}
        )
        session.add(audit)

    session.commit()
    return {"message": f"Successfully rejected and trashed {rejected_count} files."}

@router.post("/api/v1/admin/requests/{request_id}/undo-approve")
def undo_approve(
    request_id: UUID,
    session: Session = Depends(get_session),
    admin: User = Depends(get_admin_user)
):
    """Reverses an approval: revokes XP, removes Material, sets back to PENDING."""
    request = session.get(FileRequest, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found.")
        
    if request.status != "approved":
        raise HTTPException(status_code=400, detail="Only approved requests can be undone.")

    # 1. Revoke ALL XP awarded for this request — both the approval XP and any
    # requested-upload bonus (a single .first() here used to leave the bonus behind).
    xp_transactions = session.exec(
        select(PointsTransaction).where(PointsTransaction.request_id == request.id)
    ).all()
    for xp_transaction in xp_transactions:
        session.exec(
            update(User).where(User.id == xp_transaction.user_id)
            .values(total_points=User.total_points - xp_transaction.amount)
        )
        session.delete(xp_transaction)

    # 2. Re-open any material requests this approval had fulfilled
    fulfilled_requests = session.exec(
        select(MaterialRequest).where(MaterialRequest.fulfilled_by_request_id == request.id)
    ).all()
    for mr in fulfilled_requests:
        mr.status = "open"
        mr.fulfilled_by_request_id = None
        mr.fulfilled_at = None
        session.add(mr)

    # 3. Find and delete the published Material from the catalog
    # Material.id == FileRequest.id (set explicitly at approval time)
    material = session.get(Material, request.id)
    if material:
        # Move the file back to pending_uploads/ so preview and re-approval work.
        # For PPTX uploads the approved blob is the converted PDF, so request.file_url
        # must follow the blob to its new pending path.
        pending_path = f"pending_uploads/{material.file_url.split('/')[-1]}"
        try:
            bucket = storage_client.bucket(BUCKET_NAME)
            bucket.rename_blob(bucket.blob(material.file_url), pending_path)
            request.file_url = pending_path
        except Exception as e:
            print(f"GCS move back to pending failed: {e}")
        session.delete(material)

    # 4. Change status back to PENDING
    request.status = "pending"

    audit = AuditLog(
        actor_id=admin.id,
        actor_name=admin.name,
        action="undo_approve",
        target_type="file_request",
        target_ids=[str(request.id)],
        meta_data={"title": request.title}
    )
    session.add(audit)
    
    session.commit()
    return {"message": "Approval undone. File is back in pending queue and XP revoked."}

@router.post("/api/v1/admin/requests/{request_id}/undo-reject")
def undo_reject(
    request_id: UUID,
    session: Session = Depends(get_session),
    admin: User = Depends(get_admin_user)
):
    request = session.get(FileRequest, request_id)
    if not request or request.status != "rejected":
        raise HTTPException(status_code=404, detail="Rejected request not found.")

    # RESCUE FROM TRASH
    filename = request.file_url.split('/')[-1]
    pending_path = f"pending_uploads/{filename}"
    
    try:
        bucket = storage_client.bucket(BUCKET_NAME)
        trash_blob = bucket.blob(request.file_url)
        bucket.rename_blob(trash_blob, pending_path)
        
        # Update the database back to the pending location
        request.file_url = pending_path 
    except Exception as e:
        print(f"GCS Rescue failed: {e}")

    # Flip the status and clear the rejection note
    request.status = "pending"
    request.admin_note = None 

    audit = AuditLog(
        actor_id=admin.id,
        actor_name=admin.name,
        action="undo_reject",
        target_type="file_request",
        target_ids=[str(request.id)],
        meta_data={"title": request.title}
    )
    session.add(audit)

    session.commit()
    
    return {"message": "Rejection undone. File rescued from trash and back in pending queue."}

# NOTE: Lecturer ↔ course assignment now lives on the admin Lecturers/Courses
# pages, backed by the /api/v1/moderator/* endpoints (admins pass the moderator
# guard). The former /api/v1/admin/courses/{id}/lecturers endpoints were retired
# along with the Catalog page.

@router.get("/api/v1/admin/requests/stats")
def get_request_stats(
    session: Session = Depends(get_session),
    admin: User = Depends(get_admin_user)
):
    """Returns top-level metrics for the Admin dashboard."""
    # Count how many requests are currently pending
    statement = select(func.count(FileRequest.id)).where(FileRequest.status == "pending")
    pending_count = session.exec(statement).one()
    
    today_start = datetime.datetime.now(datetime.timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    approved_count_today = session.exec(
        select(func.count(AuditLog.id)).where(
            AuditLog.timestamp >= today_start,
            AuditLog.action.in_(("approve", "bulk_approve"))
        )
    ).one()
    
    rejected_count_today = session.exec(
        select(func.count(AuditLog.id)).where(
            AuditLog.timestamp >= today_start,
            AuditLog.action.in_(("reject", "bulk_reject"))
        )
    ).one()
    
    return {
        "pending": pending_count,
        "approvedToday": approved_count_today, 
        "rejectedToday": rejected_count_today
    }

@router.get("/api/v1/admin/audit-logs")
def list_audit_logs(
    action: Optional[str] = Query(None),
    actorId: Optional[UUID] = Query(None),
    limit: int = Query(default=50, ge=1, le=100),
    session: Session = Depends(get_session),
    admin: User = Depends(get_admin_user)
):
    """Returns the history of admin moderation actions."""
    statement = select(AuditLog).order_by(AuditLog.timestamp.desc())
    
    if action:
        statement = statement.where(AuditLog.action == action)
    if actorId:
        statement = statement.where(AuditLog.actor_id == actorId)
        
    statement = statement.limit(limit)
    return session.exec(statement).all()

@router.get("/api/v1/admin/requests/{request_id}/url")
def get_admin_request_preview_url(
    request_id: UUID,
    session: Session = Depends(get_session),
    admin: User = Depends(get_admin_user) # Security: Admins only!
):
    """Generates a secure, 1-hour signed URL for admins to preview pending files."""
    request = session.get(FileRequest, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found.")

    try:
        bucket = storage_client.bucket(BUCKET_NAME)
        blob = bucket.blob(request.file_url) 
        
        # Generate the self-destructing link
        download_url = blob.generate_signed_url(
            version="v4",
            expiration=datetime.timedelta(hours=1),
            method="GET",
        )
        
        return {"url": download_url}
        
    except Exception as e:
        print(f"GCS Admin Preview Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate secure preview link.")

@router.get("/api/v1/admin/requests/{request_id}/preview")
def proxy_admin_request_preview(
    request_id: UUID,
    session: Session = Depends(get_session),
    admin: User = Depends(get_admin_user),
):
    request = session.get(FileRequest, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found.")
    try:
        blob = storage_client.bucket(BUCKET_NAME).blob(request.file_url)
        def iter_blob():
            with blob.open("rb") as f:
                while chunk := f.read(256 * 1024):  # 256 KB chunks
                    yield chunk
        return StreamingResponse(iter_blob(), media_type="application/pdf")
    except Exception as e:
        print(f"GCS Admin Preview Proxy Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch preview.")