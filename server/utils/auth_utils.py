import hashlib
import jwt
import requests
import os
from datetime import datetime, timezone
from fastapi import HTTPException, Security, Depends, Request
from fastapi.security import HTTPBearer
from sqlmodel import Session, select
from sqlalchemy import delete
from models import User, RevokedToken
from database import get_session

token_auth_scheme = HTTPBearer()

_jwks_client = None


def hash_token(token: str) -> str:
    """Store a digest, never the raw token, in the revocation table."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def revoke_token(session: Session, token: str, expires_at: datetime) -> None:
    """Record a token as revoked so get_verified_user rejects it despite a valid signature."""
    # Opportunistic cleanup so this table doesn't grow unbounded.
    session.execute(
        delete(RevokedToken).where(RevokedToken.expires_at < datetime.now(timezone.utc))
    )

    session.add(RevokedToken(token_hash=hash_token(token), expires_at=expires_at))
    session.commit()

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

        # 2b. Reject tokens revoked at signout — Auth0 can't invalidate a bare
        # access token server-side, so a signed-out token is otherwise still
        # cryptographically valid until it naturally expires.
        if session.get(RevokedToken, hash_token(token)):
            raise HTTPException(status_code=401, detail="Token has been revoked.")

        # 3. Check if user exists in our Neon DB
        auth0_id = payload.get("sub")
        statement = select(User).where(User.auth0_id == auth0_id)
        user = session.exec(statement).first()
        
        if not user:
            raise HTTPException(status_code=403, detail="User not registered in local database.")

        return user

    except HTTPException:
        # Deliberate rejections (revoked token, user-not-registered) must reach
        # the client as-is, not be masked as a generic "Authentication failed".
        raise
    except Exception as e:
        print(f"JWT verification failed: {e}")  # Keep for server logs
        raise HTTPException(status_code=401, detail="Authentication failed.")
    
def get_admin_user(current_user: User = Depends(get_verified_user)):
    """Admin-level gate. Hierarchy: STUDENT < ADMIN < MODERATOR — moderators inherit admin privileges."""
    if current_user.role not in ("ADMIN", "MODERATOR"):
        raise HTTPException(status_code=403, detail=f"Admin privileges required. Your role: {current_user.role}")
    return current_user

def get_moderator_user(current_user: User = Depends(get_verified_user)):
    """Moderator-only gate — the top role. Admins are NOT allowed."""
    if current_user.role != "MODERATOR":
        raise HTTPException(status_code=403, detail="Moderator privileges required.")
    return current_user