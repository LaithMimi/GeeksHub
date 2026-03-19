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
from models import FileRequest, Major, User, Course, Lecturer, UserSignUp, UserSignIn, ForgotPassword, MaterialType
from fastapi import FastAPI, HTTPException, UploadFile,Response, File, Depends, Form
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

@app.post("/api/v1/admin/requests/{request_id}/approve")
def approve_file(
    request_id: UUID,
    approve: bool, # True to approve, False to reject
    session: Session = Depends(get_session),
    admin: User = Depends(get_admin_user)
):

    request = session.get(FileRequest, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found.")

    bucket = storage_client.bucket(bucket_name)
    temp_blob = bucket.blob(request.storage_path)

    if approve:
        # 1. Move file from 'pending/' to the final course folder
        new_path = f"{request.course_id}/{request.storage_path.split('/')[-1]}"
        new_blob = bucket.rename_blob(temp_blob, new_path)
        
        # 2. In a real app, you might move this to a 'Materials' table.
        # But if you want to delete from Neon as requested:
        session.delete(request)
        session.commit()
        return {"message": "File approved and moved to course storage."}
    
    else:
        # 1. If rejected, delete the file from GCS
        temp_blob.delete()
        
        # 2. Delete the request from Neon
        session.delete(request)
        session.commit()
        return {"message": "Request rejected and file deleted."}

@app.get("/api/v1/files/{file_id}/download")
def get_file_download_url(
    file_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_verified_user)
):
    # 1. Get the storage path from Neon
    file_record = session.get(FileRequest, file_id)
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    # 2. Generate a Signed URL (valid for 15 minutes)
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(file_record.storage_path)

    url = blob.generate_signed_url(
        version="v4",
        expiration=datetime.timedelta(minutes=15),
        method="GET",
    )

    return {"download_url": url}