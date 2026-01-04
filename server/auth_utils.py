import jwt
import requests
import os
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session, select
from models import User
from database import get_session

token_auth_scheme = HTTPBearer()

def get_verified_user(auth_credentials: HTTPAuthorizationCredentials = Security(token_auth_scheme), session: Session = Depends(get_session)):
    token = auth_credentials.credentials
    domain = os.getenv("AUTH0_DOMAIN")
    audience = os.getenv("AUTH0_AUDIENCE")

    try:
        # 1. Get Auth0 Public Keys to verify the token is real
        jwks_url = f"https://{domain}/.well-known/jwks.json"
        jwks_client = jwt.PyJWKClient(jwks_url)
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
        raise HTTPException(status_code=401, detail=str(e))