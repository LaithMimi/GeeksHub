import os
import jwt
import requests
from fastapi import APIRouter, HTTPException, Depends, Response
from sqlmodel import Session, select
from auth0.authentication import GetToken
from auth0.management import Auth0
from database import get_session
from models import User
from schemas import UserSignUp, UserSignIn, ForgotPassword
from utils.auth_utils import get_verified_user

# This is the magic object that replaces "app" in this file
router = APIRouter(tags=["Authentication"])

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

@router.post("/api/v1/signup")
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

@router.post("/api/v1/signin")
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

@router.post("/api/v1/signout")
def sign_out(response: Response):
    # This clears the cookie on the browser side
    response.delete_cookie("auth_token")
    return {"message": "Logged out successfully"}

@router.post("/api/v1/forgot-password")
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

@router.get("/api/v1/me", response_model=User)
def get_my_profile(current_user: User = Depends(get_verified_user)):
    """
    Returns the current user's profile based on the JWT in the Authorization header.
    """
    return current_user
