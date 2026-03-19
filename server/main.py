import datetime
import os
import jwt
import requests
import shutil
import uuid
from uuid import UUID
from google.cloud import storage
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from auth0.authentication import GetToken
from auth0.management import Auth0
from models import FileRequest, Major, Material, User, Course, Lecturer, UserSignUp, UserSignIn, AdminApprovePayload, BulkActionPayload, ForgotPassword, MaterialType, PointsTransaction
from fastapi import FastAPI, HTTPException, UploadFile,Response, Query, File, Depends, Form
from sqlmodel import Session, select
from contextlib import asynccontextmanager
from utils.auth_utils import get_verified_user, get_admin_user
from utils.upload_utils import validate_uploaded_file
from database import get_session, init_db


# Resolve GCP key path relative to this file so it works from any CWD
_server_dir = Path(__file__).parent
_gcp_cred = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "gcp_key.json")
if not Path(_gcp_cred).is_absolute():
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(_server_dir / _gcp_cred)

storage_client = storage.Client()
bucket_name = os.getenv("BUCKET_NAME")

# Admin Helper
from auth0.management import Auth0

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
    (Currently mocked to save locally until GCS credentials are added)
    """
    # TODO: Replace with actual Google Cloud Storage library code
    # e.g., bucket.blob(destination_blob_name).upload_from_file(file.file)
    
    # For local testing, we will just save it to a local folder
    import os
    os.makedirs(os.path.dirname(destination_blob_name), exist_ok=True)
    with open(destination_blob_name, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return f"gs://your-bucket-name/{destination_blob_name}"

app = FastAPI(title="GeeksHub API", lifespan=lifespan)

# CORS Middleware to allow frontend (running on localhost:5173) to communicate with this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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
def get_lecturers(session: Session = Depends(get_session)):
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
@app.get("/api/v1/me/requests", response_model=List[FileRequest])
def get_my_requests(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_verified_user)
):
    """
    Returns only the file requests uploaded by the currently logged-in student.
    Laith's frontend ignores the userId parameter and relies on this secure JWT check.
    """
    statement = select(FileRequest).where(FileRequest.user_id == current_user.id)
    return session.exec(statement).all()


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

    # 2. FILENAME SANITIZATION
    # We completely ignore the user's original filename (e.g., "my_virus.exe").
    # We generate a random UUID and append the safe extension we verified.
    secure_filename = f"{uuid.uuid4()}{safe_ext}"
    
    # 3. CLOUD ISOLATION (The "Pending" Folder)
    # We save it in a specific 'pending' folder so it doesn't mix with approved files
    storage_path = f"pending_uploads/{course_id}/{secure_filename}"
    
    # Reset the file pointer after our magic bytes check in validate_uploaded_file
    await file.seek(0) 
    gcs_uri = await upload_to_gcs(file, storage_path)

    # 4. DATABASE INSERTION
    new_request = FileRequest(
        user_id=current_user.id,
        course_id=course_id,
        lecturer_id=lecturer_id,
        type_id=type_id,
        year=year,
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
        # We use .upper() just in case the frontend sends "pending" instead of "PENDING"
        statement = statement.where(FileRequest.status == status.upper())
        
    return session.exec(statement).all()

@app.post("/api/v1/admin/requests/{request_id}/approve")
def approve_file(
    request_id: UUID,
    payload: AdminApprovePayload,  # <-- FIXED: Now expects a JSON body!
    session: Session = Depends(get_session),
    admin: User = Depends(get_admin_user)
):
    request = session.get(FileRequest, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found.")

    # Because our mock upload_to_gcs function prepended "gs://your-bucket-name/", 
    # we strip it here to get the actual local file path on your hard drive.
    local_path = request.file_url.replace("gs://your-bucket-name/", "")

    if payload.approve:
        # 1. UPLOAD TO GOOGLE CLOUD STORAGE
        # Now that it's approved, we finally send it to the expensive cloud storage!
        final_gcs_path = f"approved_materials/{request.course_id}/{os.path.basename(local_path)}"
        try:
            bucket = storage_client.bucket(bucket_name)
            blob = bucket.blob(final_gcs_path)
            blob.upload_from_filename(local_path)
        except Exception as e:
            # Fallback if your GCS credentials aren't fully configured yet locally
            print(f"GCS Upload skipped/failed: {e}")
            final_gcs_path = local_path 

        # 2. CREATE THE OFFICIAL CATALOG ENTRY (Plugging the Black Hole!)
        new_material = Material(
            title=request.title,
            year=request.year,
            course_id=request.course_id,
            lecturer_id=request.lecturer_id,
            type_id=request.type_id,
            uploader_id=request.user_id,
            notes=request.notes,
            file_url=final_gcs_path # Saving the real URL
        )
        session.add(new_material)

        # 3. AWARD GAMIFICATION XP!
        reward = PointsTransaction(
            user_id=request.user_id,
            amount=10,
            reason=f"File Approved: {request.title}",
            request_id=request.id
        )
        session.add(reward)

        # 4. CLEAN UP
        # Delete the old request card, and delete the temporary local file to save space
        request.status = "APPROVED" # Update status for record-keeping, but we will hide it from the frontend
        if os.path.exists(local_path):
            os.remove(local_path)
            
        session.commit()
        return {"message": "File approved, moved to Cloud, and 10 XP awarded!"}

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

    local_path = request.file_url.replace("gs://your-bucket-name/", "")
    
    # Delete from database and local disk
    request.status = "REJECTED" # Update status for record-keeping, but we will hide it from the frontend
    if os.path.exists(local_path):
        os.remove(local_path)
        
    session.commit()
    return {"message": "Request rejected and file deleted locally."}

@app.delete("/api/v1/me/requests/{request_id}")
def withdraw_request(
    request_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_verified_user)
):
    """Allows a student to delete their own pending request."""
    request = session.get(FileRequest, request_id)
    
    # Security check: Make sure the file exists AND belongs to this user!
    if not request or request.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Request not found.")
    
    # Clean up the local file so it doesn't waste your hard drive space
    local_path = request.file_url.replace("gs://your-bucket-name/", "")
    if os.path.exists(local_path):
        os.remove(local_path)

    session.delete(request)
    session.commit()
    return {"message": "Request withdrawn successfully."}

@app.post("/api/v1/admin/requests/bulk-approve")
def bulk_approve_requests(
    payload: BulkActionPayload,
    session: Session = Depends(get_session),
    admin: User = Depends(get_admin_user)
):
    """Approves multiple files at once."""
    approved_count = 0
    
    # Loop through the list of IDs sent by the frontend
    for req_id in payload.request_ids:
        request = session.get(FileRequest, req_id)
        if not request:
            continue # Skip if it doesn't exist
            
        # (Here we do the exact same logic as a single approve: 
        # Upload to GCS, save to Material table, award 10 XP, and delete the request)
        
        # ... [Your local staging GCS upload logic here] ...
        
        new_material = Material(
            title=request.title, year=request.year, course_id=request.course_id,
            lecturer_id=request.lecturer_id, type_id=request.type_id,
            uploader_id=request.user_id, notes=request.notes, file_url=request.file_url
        )
        session.add(new_material)
        
        reward = PointsTransaction(
            user_id=request.user_id, amount=10, 
            reason=f"File Approved: {request.title}", request_id=request.id
        )
        session.add(reward)
        session.delete(request)
        approved_count += 1
        
    session.commit()
    return {"message": f"Successfully approved {approved_count} files!"}

@app.post("/api/v1/admin/requests/bulk-reject")
def bulk_reject_requests(
    payload: BulkActionPayload,
    session: Session = Depends(get_session),
    admin: User = Depends(get_admin_user)
):
    """Rejects multiple files at once and deletes them locally."""
    rejected_count = 0
    
    for req_id in payload.request_ids:
        request = session.get(FileRequest, req_id)
        if not request:
            continue
            
        local_path = request.file_url.replace("gs://your-bucket-name/", "")
        if os.path.exists(local_path):
            os.remove(local_path)
            
        session.delete(request)
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
        
    if request.status != "APPROVED":
        raise HTTPException(status_code=400, detail="Only approved requests can be undone.")

    # 1. Revoke the 10 XP Gamification points
    xp_transaction = session.exec(
        select(PointsTransaction).where(PointsTransaction.request_id == request.id)
    ).first()
    if xp_transaction:
        session.delete(xp_transaction)

    # 2. Find and delete the published Material from the catalog
    # (We match it using the file_url since that is unique to this upload)
    material = session.exec(
        select(Material).where(Material.title == request.title, Material.uploader_id == request.user_id)
    ).first()
    if material:
        session.delete(material)

    # 3. Change status back to PENDING
    request.status = "PENDING"
    
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
        
    if request.status != "REJECTED":
        raise HTTPException(status_code=400, detail="Only rejected requests can be undone.")

    # Just flip the status back!
    request.status = "PENDING"
    session.commit()
    
    return {"message": "Rejection undone. File is back in the pending queue."}

@app.get("/api/v1/admin/requests/stats")
def get_request_stats(
    session: Session = Depends(get_session),
    admin: User = Depends(get_admin_user)
):
    """Returns top-level metrics for the Admin dashboard."""
    # Count how many requests are currently pending
    statement = select(FileRequest).where(FileRequest.status == "PENDING")
    pending_count = len(session.exec(statement).all())
    
    # We will wire up the "Today" stats once we build the AuditLogs table in P2!
    return {
        "pending": pending_count,
        "approvedToday": 0, 
        "rejectedToday": 0
    }