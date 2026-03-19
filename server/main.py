import datetime
import os
import random
import string
import jwt
import requests
from uuid import UUID
from google.cloud import storage
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from auth0.authentication import GetToken
from auth0.management import Auth0
from models import FileRequest, Major, Material, User, Course, Lecturer, UserSignUp, UserSignIn,FileRequestEnriched, BulkActionPayload, ForgotPassword, MaterialType, PointsTransaction
from fastapi import FastAPI, HTTPException, UploadFile,Response, Query, File, Depends, Form
from sqlmodel import Session, select
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
    session: Session = Depends(get_session)
):
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
    """Enriched student queue (Tasks 2 & 10)"""
    # Join the tables to grab the real names instead of just UUIDs
    statement = select(FileRequest, Course, Lecturer).join(Course).join(Lecturer).where(FileRequest.user_id == current_user.id)
    results = session.exec(statement).all()
    
    enriched_list = []
    for request, course, lecturer in results:
        # Check if this was approved (if so, the Material ID matches the Request ID)
        mat_id = request.id if request.status == "approved" else None
        
        xp = session.exec(
            select(PointsTransaction).where(
                PointsTransaction.request_id == request.id
            )
        ).first()
        pts = xp.amount if xp else 0
        
        enriched_list.append(
            FileRequestEnriched(
                id=request.id, title=request.title, status=request.status,
                material_year=request.material_year,
                course_name=course.name, lecturer_name=lecturer.name,
                material_id=mat_id, points_awarded=pts,
                created_at=request.created_at, admin_note=request.admin_note
            )
        )
    return enriched_list


# --- FILE STORAGE ROUTES ---

@app.post("/api/v1/courses/{course_id}/upload")
async def upload_course_file(
    course_id: UUID,
    # Using Form(...) because we are receiving multipart/form-data, not JSON!
    title: str = Form(...),
    year: int = Form(...),
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
        material_year=year,
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
        # We use .lower() since the database stores "pending", "approved", "rejected"
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
        title=request.title, material_year=request.material_year, 
        course_id=request.course_id, lecturer_id=request.lecturer_id, type_id=request.type_id,
        uploader_id=request.user_id, notes=request.notes, file_url=final_gcs_path
    )
    session.add(new_material)

    reward = PointsTransaction(
        user_id=request.user_id, amount=XP_UPLOAD_APPROVAL, action="upload_approved",
        reason=f"File Approved: {request.title}", request_id=request.id
    )
    session.add(reward)

    request.status = "approved"
    session.commit()
    return {"message": "File approved!"}

@app.post("/api/v1/admin/requests/{request_id}/reject")
def reject_request(
    request_id: UUID,
    session: Session = Depends(get_session),
    admin: User = Depends(get_admin_user)
):
    """Dedicated route to reject a file and delete it from local storage."""
    request = session.get(FileRequest, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found.")

    # 1. Delete the file from Google Cloud Storage
    try:
        bucket = storage_client.bucket(bucket_name)
        temp_blob = bucket.blob(request.file_url)
        temp_blob.delete()  # Instantly removes it from the cloud!
    except Exception as e:
        # We catch the error just in case the file was already deleted manually 
        # so the database can still update successfully.
        print(f"GCS Delete failed or file not found: {e}")

    # 2. Update the status in the database
    request.status = "rejected"
    
    session.commit()
    return {"message": "Request rejected and file deleted from Cloud storage."}

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
    approved_count: int = 0
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
            title=request.title, material_year=request.material_year,
            course_id=request.course_id, lecturer_id=request.lecturer_id, type_id=request.type_id,
            uploader_id=request.user_id, notes=request.notes, file_url=final_gcs_path
        )
        session.add(new_material)
        
        # 3. AWARD GAMIFICATION XP
        reward = PointsTransaction(
            user_id=request.user_id, amount=XP_UPLOAD_APPROVAL, action="upload_approved",
            reason=f"File Approved: {request.title}", request_id=request.id
        )
        session.add(reward)
        
        # 4. UPDATE STATUS
        request.status = "approved"
        approved_count += 1
        
    session.commit()
    return {"message": f"Successfully approved {approved_count} files!"}

@app.post("/api/v1/admin/requests/bulk-reject")
def bulk_reject_requests(
    payload: BulkActionPayload,
    session: Session = Depends(get_session),
    admin: User = Depends(get_admin_user)
):
    """Rejects multiple files at once and deletes them from Google Cloud Storage."""
    rejected_count: int = 0
    bucket = storage_client.bucket(bucket_name)
    
    for req_id in payload.request_ids:
        request = session.get(FileRequest, req_id)
        if not request or request.status != "pending":
            continue
            
        # 1. Delete from Google Cloud Storage
        try:
            temp_blob = bucket.blob(request.file_url)
            temp_blob.delete()
        except Exception as e:
            print(f"GCS Delete failed for {req_id}: {e}")
            # We don't skip here! Even if GCS fails (e.g. file already gone),
            # we still want to mark it as rejected in the database.
            
        # 2. Update status in database
        request.status = "rejected"
        rejected_count += 1
        
    session.commit()
    return {"message": f"Successfully rejected and deleted {rejected_count} files."}

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
        session.delete(xp_transaction)

    # 2. Find and delete the published Material from the catalog
    # (We match it using the file_url since that is unique to this upload)
    material = session.get(Material, request.id)
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
    """Reverses a rejection and sets the status back to PENDING."""
    request = session.get(FileRequest, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found.")
        
    if request.status != "rejected":
        raise HTTPException(status_code=400, detail="Only rejected requests can be undone.")

    # Just flip the status back!
    request.status = "pending"
    session.commit()
    
    return {"message": "Rejection undone. File is back in the pending queue."}

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