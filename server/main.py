import datetime
import os
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from contextlib import asynccontextmanager
from sqlmodel import Session, select
from typing import List, Optional
from auth0.authentication import GetToken
from auth0.management import Auth0
from models import FileRequest, FileUploadCreate, Major, User, Course, UserSignUp, UserSignIn
from auth_utils import get_verified_user
from database import get_session, init_db
from uuid import UUID
from google.cloud import storage

storage_client = storage.Client()
bucket_name = os.getenv("BUCKET_NAME")

# Admin Helper
def get_auth0_admin():
    try:
        domain = os.getenv("AUTH0_DOMAIN")
        get_token = GetToken(domain, os.getenv("AUTH0_M2M_ID"), client_secret=os.getenv("AUTH0_M2M_SECRET"))
        token = get_token.client_credentials(f'https://{domain}/api/v2/')
        return Auth0(domain, token['access_token'])
    except Exception as e:
        print(f"Auth0 Admin Error: {e}")
        return None

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Starting up: Initializing Neon Database...")
    init_db()
    yield 
    print("Shutting down...")

app = FastAPI(title="GeeksHub API", lifespan=lifespan)

# --- PUBLIC ROUTES ---

@app.post("/api/v1/signup")
def sign_up(payload: UserSignUp, session: Session = Depends(get_session)):
    # lowercase and trim email for consistency
    clean_email = payload.email.lower().strip()
    # Check Neon DB first
    existing_user = session.exec(select(User).where(User.email == clean_email)).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    # Call Auth0 to create user
    admin = get_auth0_admin()
    if not admin:
        raise HTTPException(status_code=500, detail="Identity provider unavailable.")
    
    try:
        auth0_user = admin.users.create({
            "email": clean_email,
            "password": payload.password,
            "nickname": payload.username,
            "connection": "Username-Password-Authentication"
        })
        
        new_user = User(
            auth0_id=auth0_user['user_id'],
            email=payload.email,
            display_name=payload.username
        )
        session.add(new_user)
        session.commit()
        return {"message": "Account created! You can now sign in."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/v1/signin")
def sign_in(payload: UserSignIn, session: Session = Depends(get_session)):
    clean_email = payload.email.lower().strip()
    # Use payload.email and payload.password instead of email/password
    user = session.exec(select(User).where(User.email == clean_email)).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account found. Please sign up.")

    domain = os.getenv("AUTH0_DOMAIN")
    try:
        get_token = GetToken(domain, os.getenv("AUTH0_M2M_ID"), client_secret=os.getenv("AUTH0_M2M_SECRET"))
        token = get_token.login(
            username=clean_email,    # Updated
            password=payload.password, # Updated
            scope="openid profile email",
            audience=os.getenv("AUTH0_AUDIENCE"),
            realm="Username-Password-Authentication"
        )
        return token
    except Exception as e:
        print(f"Auth0 Login Error: {e}") 
        raise HTTPException(status_code=401, detail=str(e))

# --- PROTECTED ROUTES ---

@app.get("/api/v1/majors", response_model=List[Major])
def list_majors(
    session: Session = Depends(get_session),
    # Use Depends instead of Security(auth0.require_auth)
    current_user: User = Depends(get_verified_user) 
):
    return session.exec(select(Major)).all()

@app.post("/api/v1/requests", status_code=201)
def create_file_request(
    payload: FileUploadCreate, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_verified_user)
):
    new_request = FileRequest(
        user_id=current_user.id,
        course_id=payload.course_id,
        type_id=payload.type_id,
        lecturer=payload.lecturer, 
        title=payload.title,
        storage_path="pending_upload/",
    )
    session.add(new_request)
    session.commit()
    session.refresh(new_request)
    return {"message": "Request created!", "id": new_request.id}

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

# --- FILE STORAGE ROUTES ---

@app.post("/api/v1/courses/{course_id}/upload")
async def upload_file(
    course_id: UUID,
    title: str,
    type_id: str,
    lecturer: str,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_verified_user)
):
    # 1. Create a unique filename to prevent overwriting
    file_ext = file.filename.split(".")[-1]
    unique_filename = f"{UUID}.{file_ext}"
    gcs_path = f"{course_id}/{unique_filename}"

    # 2. Upload to GCS
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(gcs_path)
    
    content = await file.read()
    blob.upload_from_string(content, content_type=file.content_type)

    # 3. Save Metadata to Neon
    new_request = FileRequest(
        user_id=current_user.id,
        course_id=course_id,
        type_id=type_id,
        title=title,
        lecturer=lecturer,
        storage_path=gcs_path,
        status="APPROVED" 
    )
    session.add(new_request)
    session.commit()
    
    return {"message": "Upload successful", "storage_path": gcs_path}

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