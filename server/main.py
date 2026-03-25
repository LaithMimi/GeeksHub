import os
import random
import string
import jwt
import requests
from datetime import datetime, timezone
from uuid import UUID
from google.cloud import storage
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from auth0.authentication import GetToken
from auth0.management import Auth0
from models import FileRequest, FileViewingSession, FileViewingSession, LeaderboardEntry, Major, Material, MyReputationResponse, NotePayload, User, Course, Lecturer, UserNote, UserSignUp, UserSignIn,FileRequestEnriched,AdminRejectPayload, BulkRejectPayload, BulkActionPayload, ForgotPassword, MaterialType, PointsTransaction, SessionStartResponse, RecentFileResponse, UserRecentFile, UserPlatformSession, UserCourseActivity, ViewerHeartbeatPayload, ViewerSessionEndPayload, ViewerSessionStartPayload
from fastapi import FastAPI, HTTPException, UploadFile,Response, Query, File, Depends, Form
from sqlmodel import Session, func, select
from contextlib import asynccontextmanager
from utils.auth_utils import get_verified_user, get_admin_user
from utils.upload_utils import validate_uploaded_file
from database import get_session, init_db


XP_UPLOAD_APPROVAL = 25

# Resolve GCP key path relative to this file so it works from any CWD
_server_dir = Path(__file__).parent
_gcp_cred = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "gcp_key.json")
if not Path(_gcp_cred).is_absolute():
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(_server_dir / _gcp_cred)

storage_client = storage.Client()
bucket_name = os.getenv("BUCKET_NAME")

# Admin Helpers

def get_auth0_admin():
    try:
        domain = os.getenv("AUTH0_DOMAIN")
        # 1. Get the token as before
        get_token = GetToken(
            domain, 
            os.getenv("AUTH0_M2M_ID"), 
            client_secret=os.getenv("AUTH0_M2M_SECRET")
        )
        token_data = get_token.client_credentials(f'https://{domain}/api/v2/')
        
        # 2. Initialize using the NEW keyword names from your help output
        # tenant_domain: the 'domain' from your .env
        # token: the access_token string
        return Auth0(
            tenant_domain=domain, 
            token=token_data['access_token']
        )
        
    except Exception as e:
        print(f"Auth0 Admin Error: {e}")
        return None

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Starting up: Initializing Neon Database...")
    init_db()
    yield 
    print("Shutting down...")

async def upload_to_gcs(file: UploadFile, destination_blob_name: str):
    """
    Uploads a file to the Google Cloud Storage bucket.
    """
    try:
        # 1. Connect to your specific bucket
        bucket = storage_client.bucket(bucket_name)
        
        # 2. Create a "blob" (Google's term for a file) at the destination path
        blob = bucket.blob(destination_blob_name)
        
        # 3. Ensure we are reading from the very beginning of the file stream
        file.file.seek(0)
        
        # 4. Upload directly from the memory buffer to Google Cloud!
        blob.upload_from_file(file.file, content_type=file.content_type)
        
        # Return the exact path inside the bucket so we can store it in Neon DB
        return destination_blob_name
        
    except Exception as e:
        print(f"FATAL GCS ERROR: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload file to cloud storage.")

app = FastAPI(title="GeeksHub API", lifespan=lifespan)

# CORS Middleware to allow frontend (running on localhost:5173) to communicate with this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")],
    allow_credentials=True,   # Allows cookies to be sent in cross-origin requests
    allow_methods=["*"],  # Allows GET, POST, OPTIONS, etc.
    allow_headers=["*"],  # Allows the Authorization header for JWTs
)

# --- CATALOG DATA ROUTES ---

@app.get("/api/v1/years")
def get_years():
    """Returns static academic years for the frontend dropdowns/MyPath."""
    return [
        {"id": "1", "label": "Freshman (Year 1)"},
        {"id": "2", "label": "Sophomore (Year 2)"},
        {"id": "3", "label": "Junior (Year 3)"},
        {"id": "4", "label": "Senior (Year 4)"}
    ]

@app.get("/api/v1/semesters")
def get_semesters():
    """Returns static semesters for the frontend dropdowns/MyPath."""
    return [
        {"id": "fall", "label": "Fall Semester"},
        {"id": "spring", "label": "Spring Semester"},
        {"id": "summer", "label": "Summer Semester"}
    ]

@app.get("/api/v1/lecturers")
def get_lecturers(
    course_id: Optional[UUID] = Query(None),
    session: Session = Depends(get_session)):

    """Fetches all lecturers from the database."""
    lecturers = session.exec(select(Lecturer)).all()
    return lecturers

# --- PUBLIC ROUTES ---

@app.get("/api/v1/health")
def health_check(session: Session = Depends(get_session)):
    try:
        # Try a simple query to Neon
        session.exec(select(1)).first()
        return {"status": "online", "database": "connected"}
    except Exception:
        return {"status": "online", "database": "disconnected"}

@app.post("/api/v1/signup")
def sign_up(payload: UserSignUp, session: Session = Depends(get_session)):
    clean_email = payload.email.lower().strip()
    
    # --- DOMAIN CHECK ---
    ALLOWED_DOMAINS = ["@post.jce.ac.il"]
    if not any(clean_email.endswith(domain) for domain in ALLOWED_DOMAINS):
        raise HTTPException(
            status_code=400, 
            detail=f"Registration is currently restricted to Azrieli College students ({ALLOWED_DOMAINS})."
        )

    # 1. Check Neon DB first
    existing_user = session.exec(select(User).where(User.email == clean_email)).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    admin = get_auth0_admin()
    if not admin:
        raise HTTPException(status_code=500, detail="Identity provider unavailable.")
    
    auth0_id = None # Track this for the rollback
    
    try:
        # 2. Create user in Auth0
        auth0_user = admin.users.create(
            email=clean_email,
            password=payload.password,
            name=payload.username,
            connection="Username-Password-Authentication"
        )
        auth0_id = auth0_user.user_id
        
        # 3. Save to Neon DB
        new_user = User(
            auth0_id=auth0_id,
            email=clean_email,
            name=payload.username,
            role="STUDENT",
            major_id=payload.major_id # Saving the chosen major UUID into the database
        )
        session.add(new_user)
        session.commit()
        session.refresh(new_user)
        return new_user

    except Exception as e:
        # ROLLBACK: If we created the Auth0 user but the DB failed, delete the Auth0 user
        if auth0_id:
            print(f"Rolling back: Deleting Auth0 user {auth0_id} due to DB error.")
            admin.users.delete(auth0_id)
            
        raise HTTPException(status_code=400, detail=f"Registration failed: {str(e)}")

@app.post("/api/v1/signin")
def sign_in(payload: UserSignIn, response: Response, session: Session = Depends(get_session)):
    clean_email = payload.email.lower().strip()
    # Use payload.email and payload.password instead of email/password
    user = session.exec(select(User).where(User.email == clean_email)).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account found. Please sign up.")

    domain = os.getenv("AUTH0_DOMAIN")
    try:
        get_token = GetToken(domain, os.getenv("AUTH0_M2M_ID"), client_secret=os.getenv("AUTH0_M2M_SECRET"))
        auth0_response = get_token.login(
            username=clean_email,    # Updated
            password=payload.password, # Updated
            scope="openid profile email",
            audience=os.getenv("AUTH0_AUDIENCE"),
            realm="Username-Password-Authentication"
        )

        # Check if email is verified before allowing sign in
        id_token = auth0_response.get("id_token")
        if id_token:
            # We can decode without verifying signature here because it came directly from Auth0 over secure HTTPS
            token_payload = jwt.decode(id_token, options={"verify_signature": False})
            print(f"DEBUG ID Token: {token_payload}")
            if not token_payload.get("email_verified"):
                raise HTTPException(status_code=403, detail="Email not verified. Please verify your email before signing in.")
            
        access_token = auth0_response.get("access_token")

        # SET THE HTTP-ONLY COOKIE
        response.set_cookie(
            key = "auth_token",
            value = access_token,
            httponly=True,  # Prevents JS from reading the token
            secure=False,    # Only send cookie over HTTPS
            samesite="lax", # CSRF protection
            max_age=86400 # 24 hours
        )
        return {"user": user}
    
    except Exception as e:
        print(f"Auth0 Login Error: {e}") 
        raise HTTPException(status_code=401, detail=str(e))
    
@app.post("/api/v1/signout")
def sign_out(response: Response):
    # This clears the cookie on the browser side
    response.delete_cookie("auth_token")
    return {"message": "Logged out successfully"}

@app.post("/api/v1/forgot-password")
def forgot_password(payload: ForgotPassword):
    domain = os.getenv("AUTH0_DOMAIN")
    client_id = os.getenv("AUTH0_M2M_ID") 
    
    url = f"https://{domain}/dbconnections/change_password"
    data = {
        "client_id": client_id,
        "email": payload.email.lower().strip(),
        "connection": "Username-Password-Authentication"
    }
    
    # Trigger the email from Auth0
    response = requests.post(url, json=data)
    
    # SECURITY BEST PRACTICE: Always return a generic success message.
    # If you return a 404 "User not found", hackers can use this to guess 
    # which emails are registered in your database (Email Enumeration).
    return {"message": "If an account with that email exists, a password reset link has been sent."}

@app.get("/api/v1/me", response_model=User)
def get_my_profile(current_user: User = Depends(get_verified_user)):
    """
    Returns the current user's profile based on the JWT in the Authorization header.
    """
    return current_user

# --- PROTECTED ROUTES ---

@app.get("/api/v1/majors", response_model=List[Major])
def list_majors(
    session: Session = Depends(get_session) 
):
    return session.exec(select(Major)).all()

@app.get("/api/v1/types", response_model=List[MaterialType])
def list_material_types(
    session: Session = Depends(get_session) 
):
    return session.exec(select(MaterialType)).all()

@app.get("/api/v1/files", response_model=List[Material])
def list_files(
    course_id: Optional[UUID] = Query(None),
    type_id: Optional[UUID] = Query(None),
    lecturer_id: Optional[UUID] = Query(None),
    search: Optional[str] = Query(None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_verified_user)
):
    """
    Returns a list of approved materials.
    Leaves the downloadUrl blank so the frontend fetches it only when clicked.
    """
    # Note: We query the Material table, which represents approved files.
    statement = select(Material)

    # Apply all the filters
    if course_id:
        statement = statement.where(Material.course_id == course_id)
    if type_id:
        statement = statement.where(Material.type_id == type_id)
    if lecturer_id:
        statement = statement.where(Material.lecturer_id == lecturer_id)
    if search:
        statement = statement.where(Material.title.ilike(f"%{search}%"))

    # Execute and return the list
    materials = session.exec(statement).all()
    return materials

@app.get("/api/v1/files/{file_id}")
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
        bucket = storage_client.bucket(bucket_name)
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

    return response_data

@app.get("/api/v1/courses", response_model=List[Course])
def search_courses(
    major_id: Optional[UUID] = None,
    year_id: Optional[int] = None,
    query: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_verified_user)
):
    # Start with a base query
    statement = select(Course)

    # Apply filters if provided
    if major_id:
        statement = statement.where(Course.major_id == major_id)
    if year_id:
        statement = statement.where(Course.year_id == year_id)
    if query:
        # Search by both name and code (case-insensitive)
        statement = statement.where(
            (Course.name.ilike(f"%{query}%")) | (Course.code.ilike(f"%{query}%"))
        )

    results = session.exec(statement).all()
    return results

@app.get("/api/v1/courses/{course_id}")
def get_single_course(course_id: UUID, session: Session = Depends(get_session)):
    """Fetches a single course by its ID."""
    course = session.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course

# THE STUDENT FILE REQUESTS 
@app.get("/api/v1/me/requests", response_model=List[FileRequestEnriched])
def get_my_requests(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_verified_user)
):
    """Enriched student queue"""
    # Join the tables to grab the real names instead of just UUIDs
    statement = select(FileRequest, Course, Lecturer).join(Course).join(Lecturer).where(FileRequest.user_id == current_user.id)
    results = session.exec(statement).all()
    
    enriched_list = []
    for request, course, lecturer in results:
        # Check if this was approved (if so, the Material ID matches the Request ID)
        mat_id = request.id if request.status == "approved" else None
        # Calculate real XP from the database
        xp_transaction = session.exec(
            select(PointsTransaction).where(PointsTransaction.request_id == request.id)
        ).first()
        pts = xp_transaction.amount if xp_transaction else 0
        
        enriched_list.append(
            FileRequestEnriched(
                id=request.id, title=request.title, status=request.status,
                academic_year=request.academic_year, material_year=request.material_year,
                course_id=request.course_id, course_name=course.name, lecturer_name=lecturer.name,
                material_id=mat_id, points_awarded=pts, created_at=request.created_at,
                admin_note=request.admin_note
            )
        )
    return enriched_list


# --- FILE STORAGE ROUTES ---

@app.post("/api/v1/courses/{course_id}/upload")
async def upload_course_file(
    course_id: UUID,
    # Using Form(...) because we are receiving multipart/form-data, not JSON!
    title: str = Form(...),
    academic_year: int = Form(...),
    material_year: int = Form(...),
    type_id: UUID = Form(...), 
    lecturer_id: UUID = Form(...),
    notes: str = Form(None),
    file: UploadFile = File(...),
    current_user: User = Depends(get_verified_user),
    session: Session = Depends(get_session)
):
    # 1. THE SECURITY BOUNCER
    # This will throw a 400/413 error if it's a virus, too big, or fake extension
    safe_ext = await validate_uploaded_file(file)

    # 2. FILENAME KEEP ORIGINAL NAME (with a tiny random string to prevent overwrites)
    base_name = os.path.splitext(file.filename)[0].replace(" ", "_")
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

# --- THE ADMIN MODERATION QUEUE ---

@app.get("/api/v1/admin/requests", response_model=List[FileRequest])
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

@app.post("/api/v1/admin/requests/{request_id}/approve")
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

@app.post("/api/v1/admin/requests/{request_id}/reject")
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

@app.delete("/api/v1/me/requests/{request_id}")
def withdraw_request(
    request_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_verified_user)
):
    """Allows a student to delete their own pending request."""
    request = session.get(FileRequest, request_id)
    if not request or request.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Request not found.")
    
    try:
        bucket = storage_client.bucket(bucket_name)
        bucket.blob(request.file_url).delete()
    except Exception as e:
        print(f"GCS Delete failed: {e}")

    session.delete(request)
    session.commit()
    return {"message": "Request withdrawn successfully."}

@app.post("/api/v1/admin/requests/bulk-approve")
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

@app.post("/api/v1/admin/requests/bulk-reject")
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

@app.post("/api/v1/admin/requests/{request_id}/undo-approve")
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

@app.post("/api/v1/admin/requests/{request_id}/undo-reject")
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

@app.get("/api/v1/admin/requests/stats")
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

# --- REPUTATION & GAMIFICATION ROUTES ---

@app.get("/api/v1/me/reputation", response_model=MyReputationResponse)
def get_my_reputation(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_verified_user)
):
    """Returns the current student's XP, badge status, and transaction history."""
    
    # 1. Fetch all their points history, newest first
    statement = select(PointsTransaction).where(PointsTransaction.user_id == current_user.id).order_by(PointsTransaction.created_at.desc())
    transactions = session.exec(statement).all()
    
    # 2. Calculate their total XP
    total_points = current_user.total_points  # We keep a running total in the User table for efficiency
    
    # 3. Calculate their Badge Tier
    if total_points > 1000:
        badge = "Gold"
    elif total_points > 500:
        badge = "Silver"
    else:
        badge = "Bronze"
        
    return {
        "userId": current_user.id,
        "totalPoints": total_points,
        "badge": badge,
        "transactions": transactions
    }

@app.get("/api/v1/reputation/leaderboard", response_model=List[LeaderboardEntry])
def get_leaderboard(
    session: Session = Depends(get_session)
):
    """Returns the top 10 users with the highest XP on the platform."""
    
    # grab the top 10 users sorted by their cached points total in the User table (more efficient than summing transactions on the fly)
    statement = select(User).order_by(User.total_points.desc()).limit(10)
    
    top_users = session.exec(statement).all()
    
    leaderboard = []
    for user in top_users:
        # Calculate badge for the leaderboard display
        if user.total_points > 1000:
            badge = "Gold"
        elif user.total_points > 500:
            badge = "Silver"
        else:
            badge = "Bronze"
            
        leaderboard.append(
            LeaderboardEntry(
                userId=user.id,
                name=user.name,
                totalPoints=user.total_points,
                badge=badge
            )
        )
        
    return leaderboard

@app.post("/api/v1/me/session/start", response_model=SessionStartResponse)
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

@app.get("/api/v1/me/recent-files", response_model=List[RecentFileResponse])
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

@app.get("/api/v1/me/activity/summary")
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

@app.post("/api/v1/me/recent-files/{file_id}")
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

@app.get("/api/v1/me/notes")
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

@app.post("/api/v1/me/notes")
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

@app.post("/api/v1/me/viewer/session-start")
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

@app.post("/api/v1/me/viewer/heartbeat")
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

@app.post("/api/v1/me/viewer/session-end")
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