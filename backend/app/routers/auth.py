import os
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session
from jose import jwt, JWTError

from app.database import get_db
from app.models.user import User
from app.models.blacklisted_token import BlacklistedToken
from app.schemas.user import UserRegister, UserLogin, UserRead, Token
from app.auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, SECRET_KEY, ALGORITHM
)

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])

# Cookie secure flag: disable in development (HTTP), enable in production (HTTPS)
SECURE_COOKIES = os.getenv("SECURE_COOKIES", "false").lower() == "true"

def set_auth_cookie(response: Response, token: str):
    """Set HttpOnly, SameSite=Lax cookie for secure token storage."""
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=SECURE_COOKIES,
        samesite="lax",
        max_age=86400 * 7,  # 7 days
        path="/"
    )

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register_user(user_in: UserRegister, response: Response, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == user_in.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address is already registered"
        )

    # Security requirement: registration strictly sets role='reviewer'
    new_user = User(
        email=user_in.email,
        hashed_password=hash_password(user_in.password),
        role="reviewer"
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    access_token = create_access_token(data={"sub": new_user.id, "role": new_user.role})
    set_auth_cookie(response, access_token)
    return Token(access_token=access_token, token_type="bearer", user=UserRead.model_validate(new_user))

@router.post("/login", response_model=Token)
def login_user(user_in: UserLogin, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_in.email).first()
    if not user or not verify_password(user_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    access_token = create_access_token(data={"sub": user.id, "role": user.role})
    set_auth_cookie(response, access_token)
    return Token(access_token=access_token, token_type="bearer", user=UserRead.model_validate(user))

@router.post("/logout")
def logout_user(request: Request, response: Response, db: Session = Depends(get_db)):
    """Blacklist the current token's jti so it cannot be reused after logout."""
    token = request.cookies.get("access_token")
    if token:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            jti = payload.get("jti")
            exp = payload.get("exp")
            if jti and exp:
                expires_at = datetime.fromtimestamp(exp, tz=timezone.utc)
                blacklisted = BlacklistedToken(jti=jti, expires_at=expires_at)
                db.add(blacklisted)
                db.commit()
        except JWTError:
            pass  # Token already invalid, just clear the cookie

    response.delete_cookie(key="access_token", path="/")
    return {"message": "Logged out successfully"}

@router.get("/me", response_model=UserRead)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    return current_user


