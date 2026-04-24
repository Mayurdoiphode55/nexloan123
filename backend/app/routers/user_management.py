"""
NexLoan User Management Router — RBAC User Administration
Endpoints: /api/users — list, create-officer, change role, activate/deactivate
Protected by require_role() — only ADMIN and SUPER_ADMIN have access.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loan import User, UserRole
from app.utils.database import get_db
from app.utils.auth import get_current_user, require_role, generate_otp, create_access_token
from app.utils.redis_client import store_otp
from app.services.email_service import send_otp_email

logger = logging.getLogger("nexloan.user_management")

router = APIRouter()


# ─── Request/Response Models ────────────────────────────────────────────────────


class CreateOfficerRequest(BaseModel):
    """Create a new Loan Officer account."""
    full_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    mobile: str = Field(..., pattern=r"^\d{10}$")


class ChangeRoleRequest(BaseModel):
    """Change a user's role."""
    role: str = Field(..., description="New role: BORROWER, LOAN_OFFICER, ADMIN, SUPER_ADMIN")


class ChangeStatusRequest(BaseModel):
    """Activate or deactivate a user."""
    is_active: bool


class UserResponse(BaseModel):
    """User data response."""
    id: str
    full_name: str
    email: str
    mobile: str
    role: str
    is_active: bool
    is_verified: bool
    created_at: str


# ─── Endpoints ──────────────────────────────────────────────────────────────────


@router.get(
    "",
    summary="List all users (Admin/Super-Admin only)",
)
async def list_users(
    role: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN", "SUPER_ADMIN")),
):
    """
    Returns a list of all users. Optionally filter by role or search by name/email.
    """
    stmt = select(User).order_by(User.created_at.desc())

    if role:
        stmt = stmt.where(User.role == role)

    if search:
        stmt = stmt.where(
            (User.full_name.ilike(f"%{search}%")) |
            (User.email.ilike(f"%{search}%"))
        )

    result = await db.execute(stmt)
    users = result.scalars().all()

    return [
        {
            "id": str(u.id),
            "full_name": u.full_name,
            "email": u.email,
            "mobile": u.mobile,
            "role": u.role or "BORROWER",
            "is_active": u.is_active if hasattr(u, 'is_active') else True,
            "is_verified": u.is_verified,
            "created_at": u.created_at.isoformat(),
        }
        for u in users
    ]


@router.get(
    "/me",
    summary="Get current user profile",
)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    """Returns the authenticated user's profile including role."""
    return {
        "id": str(current_user.id),
        "full_name": current_user.full_name,
        "email": current_user.email,
        "mobile": current_user.mobile,
        "role": current_user.role or "BORROWER",
        "is_active": getattr(current_user, 'is_active', True),
        "is_verified": current_user.is_verified,
        "created_at": current_user.created_at.isoformat(),
    }


@router.post(
    "/create-officer",
    status_code=status.HTTP_201_CREATED,
    summary="Create a new Loan Officer account (Admin only)",
)
async def create_officer(
    req: CreateOfficerRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN", "SUPER_ADMIN")),
):
    """
    Creates a new user with LOAN_OFFICER role.
    Sends an OTP to their email so they can verify and login.
    """
    # Check if user already exists
    existing = await db.execute(
        select(User).where((User.email == req.email) | (User.mobile == req.mobile))
    )
    if existing.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email or mobile already exists",
        )

    # Create officer account
    officer = User(
        full_name=req.full_name,
        email=req.email,
        mobile=req.mobile,
        is_verified=False,
        role=UserRole.LOAN_OFFICER.value,
        is_active=True,
    )
    db.add(officer)
    await db.commit()
    await db.refresh(officer)

    logger.info(f"✅ Loan Officer created: {officer.email} by {current_user.email}")

    # Generate and send OTP
    otp = generate_otp(length=6)
    await store_otp(req.email, otp)
    print(f"\n{'='*60}")
    print(f"🔑 DEV: OFFICER OTP FOR {req.email} IS: {otp}")
    print(f"{'='*60}\n")

    background_tasks.add_task(send_otp_email, req.email, otp, req.full_name)

    return {
        "user_id": str(officer.id),
        "email": officer.email,
        "role": officer.role,
        "message": f"Loan Officer account created. OTP sent to {req.email}.",
    }


@router.put(
    "/{user_id}/role",
    summary="Change a user's role (Super-Admin only)",
)
async def change_user_role(
    user_id: str,
    req: ChangeRoleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("SUPER_ADMIN")),
):
    """
    Change a user's role. Only SUPER_ADMIN can do this.
    Cannot change your own role.
    """
    valid_roles = [r.value for r in UserRole]
    if req.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}",
        )

    if str(current_user.id) == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own role",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_role = user.role
    user.role = req.role
    await db.commit()

    logger.info(f"✅ Role changed: {user.email} from {old_role} to {req.role} by {current_user.email}")

    return {
        "user_id": str(user.id),
        "email": user.email,
        "old_role": old_role,
        "new_role": req.role,
        "message": "Role updated successfully",
    }


@router.put(
    "/{user_id}/status",
    summary="Activate or deactivate a user (Admin/Super-Admin)",
)
async def change_user_status(
    user_id: str,
    req: ChangeStatusRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN", "SUPER_ADMIN")),
):
    """Activate or deactivate a user account."""
    if str(current_user.id) == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = req.is_active
    await db.commit()

    action = "activated" if req.is_active else "deactivated"
    logger.info(f"✅ User {action}: {user.email} by {current_user.email}")

    return {
        "user_id": str(user.id),
        "email": user.email,
        "is_active": user.is_active,
        "message": f"User {action} successfully",
    }
