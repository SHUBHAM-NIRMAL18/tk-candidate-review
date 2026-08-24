import os
import uuid
import logging
import bcrypt
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, List
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.blacklisted_token import BlacklistedToken
from app.models.api_key import APIKey

logger = logging.getLogger(__name__)

SECRET_KEY = os.getenv("SECRET_KEY", "secret-key-change-me")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

# Warn loudly if SECRET_KEY is left as the insecure default
if SECRET_KEY == "secret-key-change-me":
    logger.warning(
        "!!!! SECRET_KEY is set to the insecure default. !!!! "
        "Set a strong SECRET_KEY environment variable before deploying to production."
    )

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def hash_password(password: str) -> str:
    pwd_bytes = password.encode("utf-8")[:72]
    return bcrypt.hashpw(pwd_bytes, bcrypt.gensalt()).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    pwd_bytes = plain_password.encode("utf-8")[:72]
    return bcrypt.checkpw(pwd_bytes, hashed_password.encode("utf-8"))

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    # Unique token ID for blacklisting support on logout
    to_encode.update({"exp": expire, "jti": str(uuid.uuid4())})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def generate_api_key_pair() -> tuple[str, str, str]:
    """Generates (raw_key, prefix, key_hash) for M2M auth."""
    raw_token = secrets.token_hex(24)
    raw_key = f"tk_live_{raw_token}"
    prefix = f"tk_live_{raw_token[:6]}..."
    key_hash = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()
    return raw_key, prefix, key_hash

def get_current_user(
    request: Request,
    bearer_token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # 1. Check for API Key in headers (X-API-Key or Authorization: Api-Key <token>)
    api_key_header = request.headers.get("X-API-Key")
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("api-key "):
        api_key_header = auth_header.split(" ", 1)[1].strip()

    if api_key_header:
        key_hash = hashlib.sha256(api_key_header.encode("utf-8")).hexdigest()
        api_key_record = db.query(APIKey).filter(
            APIKey.key_hash == key_hash,
            APIKey.is_active.is_(True)
        ).first()

        if not api_key_record:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or revoked API Key",
                headers={"WWW-Authenticate": "ApiKey"},
            )

        # Check expiration if set
        if api_key_record.expires_at:
            exp = api_key_record.expires_at
            is_expired = exp < datetime.now(timezone.utc) if exp.tzinfo is not None else exp < datetime.now(timezone.utc).replace(tzinfo=None)
            if is_expired:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="API Key has expired",
                    headers={"WWW-Authenticate": "ApiKey"},
                )

        # Update last_used_at timestamp
        api_key_record.last_used_at = datetime.now(timezone.utc)
        db.commit()

        # If key is associated with a real user, return that user; otherwise return synthetic service user
        if api_key_record.created_by_id:
            user = db.query(User).filter(User.id == api_key_record.created_by_id).first()
            if user:
                return user

        scopes_list = [s.strip() for s in api_key_record.scopes.split(",") if s.strip()]
        is_admin_scope = "admin:all" in scopes_list or "admin" in scopes_list
        return User(
            id=f"apikey_{api_key_record.id}",
            email=f"{api_key_record.name.lower().replace(' ', '_')}@api.service",
            role="admin" if is_admin_scope else "reviewer"
        )

    # 2. Priority: HttpOnly Cookie > Bearer Header
    token = request.cookies.get("access_token") or bearer_token
    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        jti: str = payload.get("jti")
        if not user_id:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Reject tokens that have been blacklisted via logout
    if jti and db.query(BlacklistedToken).filter(BlacklistedToken.jti == jti).first():
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise credentials_exception
    return user

def require_role(allowed_roles: list[str]):
    """Dependency that enforces role-based access control at the router level."""
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operation not permitted"
            )
        return current_user
    return role_checker
