from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from typing import Optional

from firebase_admin import auth, credentials
import firebase_admin

from app.core.config import settings

# Initialize Firebase Admin SDK
# Check if Firebase app is already initialized
if not firebase_admin._apps:
    try:
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred, {'projectId': settings.FIREBASE_PROJECT_ID})
    except Exception as e:
        print(f"Error initializing Firebase Admin SDK: {e}")
        # In a production environment, you might want to raise an exception or log this more severely
        pass

from app.core.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token") # You might customize the tokenUrl

async def get_current_user(id_token: str = Depends(oauth2_scheme)) -> User:
    """
    Verifies the Firebase ID token and returns the corresponding User object.
    """
    # Bypass for guest login in development/preview
    if id_token == "guest-token":
        return User(uid="guest-user", email="guest@landguard.ai")

    if not firebase_admin._apps:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Firebase Admin SDK not initialized."
        )

    try:
        # Verify the ID token
        decoded_token = auth.verify_id_token(id_token)
        uid = decoded_token['uid']
        email = decoded_token.get('email')
        
        # You might fetch more user details from your database here if needed
        return User(uid=uid, email=email)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication credentials: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )

