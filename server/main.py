import os
from fastapi import FastAPI, Depends, HTTPException, Security
from contextlib import asynccontextmanager
from sqlmodel import Session, select
from typing import List
from auth0.authentication import GetToken
from auth0.management import Auth0

# Local imports
from models import FileRequest, FileUploadCreate, Major, User, UserSignUp, UserSignIn
from auth_utils import get_verified_user
from database import get_session, init_db

# 1. Admin Helper (Same as before)
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