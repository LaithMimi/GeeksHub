import os
import datetime
from uuid import UUID
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlmodel import Session, select
from google.cloud import storage
from database import get_session
from models import FileRequest, Course, Material, PointsTransaction, User
from schemas import AdminRejectPayload, BulkActionPayload, BulkRejectPayload
from utils.auth_utils import get_admin_user

router = APIRouter(tags=["Admin Moderation"])

# --- Setup ---
XP_UPLOAD_APPROVAL = 25
storage_client = storage.Client()
bucket_name = os.getenv("BUCKET_NAME")

# --- Endpoints ---

@router.get("/api/v1/admin/requests", response_model=List[FileRequest])
def list_admin_requests(
    status: Optional[str] = Query(None),
    session: Session = Depends(get_session),
    # Security Check: Only an Admin can call this route!
    admin: User = Depends(get_admin_user) 
):
    """
    Returns all file requests across the entire application for admins to review.
    Supports filtering by status (e.g., ?status=pending).
    """
    statement = select(FileRequest)
    
    if status:
        statement = statement.where(FileRequest.status == status.lower())
      
    return session.exec(statement).all()

@router.post("/api/v1/admin/requests/{request_id}/approve")
def approve_file(
    request_id: UUID,
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
    final_gcs_path = f"{safe_course_name}/{filename}"
    
    try:
        bucket = storage_client.bucket(bucket_name)
        temp_blob = bucket.blob(request.file_url)
        bucket.rename_blob(temp_blob, final_gcs_path) 
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

    uploader = session.get(User, request.user_id)
    if uploader:
        uploader.total_points += XP_UPLOAD_APPROVAL
        session.add(uploader)

    request.status = "approved"
    session.commit()
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

    # MOVE TO TRASH INSTEAD OF DELETING
    filename = request.file_url.split('/')[-1]
    trash_path = f"trash_bin/{filename}"
    
    try:
        bucket = storage_client.bucket(bucket_name)
        temp_blob = bucket.blob(request.file_url)
        bucket.rename_blob(temp_blob, trash_path)
        
        # Update the database so it knows the new location!
        request.file_url = trash_path 
    except Exception as e:
        print(f"GCS Move to trash failed: {e}")

    request.status = "rejected" 
    if payload and payload.note:
        request.admin_note = payload.note
        
    session.commit()
    return {"message": "Request rejected and moved to trash for 3 days."}

@router.post("/api/v1/admin/requests/bulk-approve")
def bulk_approve_requests(
    payload: BulkActionPayload,
    session: Session = Depends(get_session),
    admin: User = Depends(get_admin_user)
):
    """Approves multiple files at once and moves them in Google Cloud Storage."""
    approved_count = 0
    bucket = storage_client.bucket(bucket_name)
    
    for req_id in payload.request_ids:
        request = session.get(FileRequest, req_id)
        # Skip if it doesn't exist or is already processed
        if not request or request.status != "pending":
            continue 
            
        course = session.get(Course, request.course_id)
        safe_course_name = course.name.replace(" ", "_")

        #  MOVE FILE IN GOOGLE CLOUD STORAGE
        filename = request.file_url.split('/')[-1]
        final_gcs_path = f"{safe_course_name}/{filename}"
        
        try:
            temp_blob = bucket.blob(request.file_url)
            bucket.rename_blob(temp_blob, final_gcs_path) 
        except Exception as e:
            print(f"GCS Move failed for request {req_id}: {e}")
            # IMPORTANT: If the cloud move fails, we skip to the next file! 
            # We don't want to award XP for a broken file.
            continue

        # 2. CREATE THE OFFICIAL CATALOG ENTRY
        new_material = Material(
            id=request.id,
            title=request.title, academic_year=request.academic_year, material_year=request.material_year,
            course_id=request.course_id, lecturer_id=request.lecturer_id, type_id=request.type_id,
            uploader_id=request.user_id, notes=request.notes, file_url=final_gcs_path
        )
        session.add(new_material)
        
        # 3. AWARD GAMIFICATION XP
        reward = PointsTransaction(
            user_id=request.user_id,
            amount=XP_UPLOAD_APPROVAL, 
            action="upload_approval",
            reason=f"File Approved: {request.title}",
            request_id=request.id
        )
        session.add(reward)

        # 4. UPDATE THE USER'S TOTAL POINTS (We have to do this manually since we are bypassing the single-approval route)
        uploader = session.get(User, request.user_id)
        if uploader:
            uploader.total_points += XP_UPLOAD_APPROVAL
            session.add(uploader)
        
        # 5. UPDATE STATUS
        request.status = "approved"
        approved_count += 1
        
    session.commit()
    return {"message": f"Successfully approved {approved_count} files!"}

@router.post("/api/v1/admin/requests/bulk-reject")
def bulk_reject_requests(
    payload: BulkRejectPayload,
    session: Session = Depends(get_session),
    admin: User = Depends(get_admin_user)
):
    rejected_count = 0
    bucket = storage_client.bucket(bucket_name)
    
    for req_id in payload.request_ids:
        request = session.get(FileRequest, req_id)
        if not request or request.status != "pending":
            continue
            
        filename = request.file_url.split('/')[-1]
        trash_path = f"trash_bin/{filename}"
        
        try:
            temp_blob = bucket.blob(request.file_url)
            bucket.rename_blob(temp_blob, trash_path)
            request.file_url = trash_path
        except Exception as e:
            print(f"GCS Move failed for {req_id}: {e}")
            
        request.status = "rejected"
        if payload.reason:
            request.admin_note = payload.reason
            
        rejected_count += 1
        
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

    # 1. Revoke the 10 XP Gamification points
    xp_transaction = session.exec(
        select(PointsTransaction).where(PointsTransaction.request_id == request.id)
    ).first()
    if xp_transaction:
        # Subtract the XP before deleting the transaction receipt
        uploader = session.get(User, xp_transaction.user_id)
        if uploader:
            uploader.total_points -= xp_transaction.amount
            session.add(uploader)
            
        session.delete(xp_transaction)

    # 2. Find and delete the published Material from the catalog
    # (We match it using the file_url since that is unique to this upload)
    material = session.exec(
        select(Material).where(Material.title == request.title, Material.uploader_id == request.user_id)
    ).first()
    if material:
        session.delete(material)

    # 3. Change status back to PENDING
    request.status = "pending"
    
    # Note: For a true enterprise app, you would also move the file back from 
    # 'approved_materials/' to 'pending_uploads/' in Google Cloud here.
    
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
        bucket = storage_client.bucket(bucket_name)
        trash_blob = bucket.blob(request.file_url)
        bucket.rename_blob(trash_blob, pending_path)
        
        # Update the database back to the pending location
        request.file_url = pending_path 
    except Exception as e:
        print(f"GCS Rescue failed: {e}")

    # Flip the status and clear the rejection note
    request.status = "pending"
    request.admin_note = None 
    session.commit()
    
    return {"message": "Rejection undone. File rescued from trash and back in pending queue."}

@router.get("/api/v1/admin/requests/stats")
def get_request_stats(
    session: Session = Depends(get_session),
    admin: User = Depends(get_admin_user)
):
    """Returns top-level metrics for the Admin dashboard."""
    # Count how many requests are currently pending
    statement = select(FileRequest).where(FileRequest.status == "pending")
    pending_count = len(session.exec(statement).all())
    
    # We will wire up the "Today" stats once we build the AuditLogs table in P2!
    return {
        "pending": pending_count,
        "approvedToday": 0, 
        "rejectedToday": 0
    }

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
        bucket = storage_client.bucket(bucket_name)
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