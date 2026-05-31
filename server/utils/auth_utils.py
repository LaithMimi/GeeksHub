import jwt
import requests
import os
from fastapi import HTTPException, Security, Depends, Request
from fastapi.security import HTTPBearer
from sqlmodel import Session, select
from models import User
from database import get_session

token_auth_scheme = HTTPBearer()

_jwks_client = None

def get_jwks_client():
    """Fetches the JWKS client once and caches it in memory."""
    global _jwks_client
    if _jwks_client is None:
        domain = os.getenv("AUTH0_DOMAIN")
        jwks_url = f"https://{domain}/.well-known/jwks.json"
        # Tell the client to cache the keys for 3600 seconds (1 hour)
        _jwks_client = jwt.PyJWKClient(jwks_url, cache_keys=True, lifespan=3600)
    return _jwks_client

# Utility function to verify Auth0 JWT and retrieve the corresponding user from the database
def get_verified_user(request: Request,
    session: Session = Depends(get_session)):
    token = request.cookies.get("auth_token")

    # First check for token in cookies, then fallback to Authorization header (for API clients)
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated: No cookie or header found")

    domain = os.getenv("AUTH0_DOMAIN")
    audience = os.getenv("AUTH0_AUDIENCE")

    try:
        # 1. Get Auth0 Public Keys to verify the token is real
        jwks_client = get_jwks_client()
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        # 2. Decode and validate the token
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=audience,
            issuer=f"https://{domain}/"
        )
        
        # 3. Check if user exists in our Neon DB
        auth0_id = payload.get("sub")
        statement = select(User).where(User.auth0_id == auth0_id)
        user = session.exec(statement).first()
        
        if not user:
            raise HTTPException(status_code=403, detail="User not registered in local database.")
            
        return user

    except Exception as e:
        print(f"JWT verification failed: {e}")  # Keep for server logs
        raise HTTPException(status_code=401, detail="Authentication failed.")
    
def get_admin_user(current_user: User = Depends(get_verified_user)):
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail=f"Admin privileges required. Your role: {current_user.role}")
    return current_user