"""
NexLoan Auth Utilities — JWT Token Management & OTP Generation
Provides create_access_token(), decode_token(), get_current_user() dependency,
require_role() RBAC dependency, and OTP generator.
"""

import random
import string
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

import jwt
from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.loan import User
from app.utils.database import get_db

# HTTP Bearer token scheme — auto_error=True ensures 401 if no token
security = HTTPBearer(auto_error=True)


def generate_otp(length: int = 6) -> str:
    """Generate a random numeric OTP of the specified length."""
    return "".join(random.choices(string.digits, k=length))


def create_access_token(user_id: str, email: str, role: str = "BORROWER") -> str:
    """
    Create a JWT access token with user_id, email, and role as claims.
    Token expires after JWT_EXPIRE_MINUTES from settings.
    """
    expire = datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "exp": expire,
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """
    Decode and validate a JWT token.
    Raises HTTPException 401 if the token is invalid or expired.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )


# The ONE officer email — only this account gets LOAN_OFFICER privileges
OFFICER_EMAIL = "mayurdoiphode55@gmail.com"


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    FastAPI dependency — extracts and validates the JWT from the Authorization header,
    then fetches the corresponding User from the database.

    Usage:
        @router.get("/protected")
        async def protected_route(user: User = Depends(get_current_user)):
            ...
    """
    # Decode and validate the JWT
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")

    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    try:
        user_uuid = UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID in token",
        )

    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been deactivated",
        )

    # RBAC: Only this specific email gets LOAN_OFFICER role
    if user.email == OFFICER_EMAIL:
        user.role = "LOAN_OFFICER"

    return user


def require_role(*allowed_roles: str):
    """
    FastAPI dependency factory that checks if the current user has one of the allowed roles.
    Returns the user if authorized, raises 403 if not.

    Usage:
        @router.get("/admin-only")
        async def admin_route(user: User = Depends(require_role("ADMIN", "SUPER_ADMIN"))):
            ...
    """
    async def role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:
        user_role = getattr(current_user, 'role', 'BORROWER') or 'BORROWER'
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required: {', '.join(allowed_roles)}",
            )
        return current_user
    return role_checker
