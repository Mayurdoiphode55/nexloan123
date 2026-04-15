"""
NexLoan Auth Router — Registration, OTP Verification, JWT Login
Endpoints: /register, /send-otp, /verify-otp
"""

import logging

from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.loan import User
from app.services.email_service import send_otp_email
from app.utils.auth import create_access_token, generate_otp
from app.utils.database import get_db
from app.utils.redis_client import store_otp, verify_otp

logger = logging.getLogger("nexloan.auth")

router = APIRouter()


# ─── Request/Response Models ────────────────────────────────────────────────────


class RegisterRequest(BaseModel):
    """Registration payload."""
    full_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    mobile: str = Field(..., pattern=r"^\d{10}$")  # 10-digit mobile number


class RegisterResponse(BaseModel):
    """Registration response."""
    user_id: str
    email: str
    message: str


class SendOTPRequest(BaseModel):
    """Send OTP request — can be by email or mobile."""
    identifier: str = Field(..., description="Email or 10-digit mobile number")


class VerifyOTPRequest(BaseModel):
    """OTP verification payload."""
    identifier: str = Field(..., description="Email or mobile that received the OTP")
    otp: str = Field(..., pattern=r"^\d{6}$")


class VerifyOTPResponse(BaseModel):
    """OTP verification response — includes JWT and user details."""
    access_token: str
    token_type: str = "bearer"
    user: dict


# ─── Endpoints ──────────────────────────────────────────────────────────────────


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Auth"],
    summary="Register a new user",
)
async def register(
    req: RegisterRequest, 
    background_tasks: BackgroundTasks, 
    db: AsyncSession = Depends(get_db)
):
    """
    Register a new user with full name, email, and mobile.
    Generates a 6-digit OTP, stores it in Redis with 5-min TTL,
    and sends it via email.

    Returns:
        - user_id: UUID of the newly created user
        - email: User's email
        - message: Confirmation message + OTP sent notification
    """
    # Check if user already exists by email or mobile
    existing_user = await db.execute(
        select(User).where((User.email == req.email) | (User.mobile == req.mobile))
    )
    existing_result = existing_user.scalars().first()
    logger.debug(f"Checking for existing user: email={req.email}, mobile={req.mobile}")
    logger.debug(f"Query result: {existing_result}")
    if existing_result:
        logger.warning(f"User already exists: {existing_result.email} / {existing_result.mobile}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email or mobile already exists",
        )

    # Create new user
    user = User(
        full_name=req.full_name,
        email=req.email,
        mobile=req.mobile,
        is_verified=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    logger.info(f"✅ New user registered: {user.email} ({user.id})")

    # Generate and store OTP
    otp = generate_otp(length=6)
    await store_otp(req.email, otp)
    logger.debug(f"🔐 OTP stored for {req.email}: {otp}")
    print(f"\n" + "="*60)
    print(f"🔑 DEV: YOUR OTP FOR {req.email} IS: {otp}")
    print("="*60 + "\n")

    # Send OTP via email in background
    background_tasks.add_task(send_otp_email, req.email, otp, req.full_name)

    return RegisterResponse(
        user_id=str(user.id),
        email=user.email,
        message=f"✅ User registered successfully! OTP sent to {req.email}",
    )


@router.post(
    "/send-otp",
    status_code=status.HTTP_200_OK,
    tags=["Auth"],
    summary="Send OTP to an existing user",
)
async def send_otp_endpoint(
    req: SendOTPRequest, 
    background_tasks: BackgroundTasks, 
    db: AsyncSession = Depends(get_db)
):
    """
    Send (or resend) an OTP to an existing user.
    Identifier can be an email or 10-digit mobile number.

    Returns:
        Success message with the email where OTP was sent.
    """
    # Find user by email or mobile
    stmt = select(User).where(
        (User.email == req.identifier) | (User.mobile == req.identifier)
    )
    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user:
        # For security, don't reveal if user exists or not
        return {"message": "If a user with this identifier exists, an OTP will be sent to their email."}

    # Generate and store OTP
    otp = generate_otp(length=6)
    await store_otp(user.email, otp)
    logger.debug(f"🔐 OTP regenerated for {user.email}: {otp}")
    print(f"\n" + "="*60)
    print(f"🔑 DEV: YOUR OTP FOR {user.email} IS: {otp}")
    print("="*60 + "\n")

    # Send OTP via email in background
    background_tasks.add_task(send_otp_email, user.email, otp, user.full_name)

    return {
        "message": f"✅ OTP sent to {user.email}",
        "email": user.email,
    }


@router.post(
    "/verify-otp",
    response_model=VerifyOTPResponse,
    status_code=status.HTTP_200_OK,
    tags=["Auth"],
    summary="Verify OTP and get JWT token",
)
async def verify_otp_endpoint(req: VerifyOTPRequest, db: AsyncSession = Depends(get_db)):
    """
    Verify the OTP and return a JWT access token if valid.
    Marks the user as verified.

    Returns:
        - access_token: JWT token for authenticated requests
        - token_type: "bearer"
        - user: User object (id, email, full_name, mobile, is_verified)

    Raises:
        400: OTP is invalid or expired
        404: User not found
    """
    # Verify OTP in Redis
    is_valid = await verify_otp(req.identifier, req.otp)
    if not is_valid:
        logger.warning(f"❌ Invalid/expired OTP for {req.identifier}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP",
        )

    # Find user by email or mobile
    stmt = select(User).where(
        (User.email == req.identifier) | (User.mobile == req.identifier)
    )
    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Mark user as verified
    user.is_verified = True
    db.add(user)
    await db.commit()
    await db.refresh(user)

    logger.info(f"✅ User verified via OTP: {user.email} ({user.id})")

    # Create JWT token
    token = create_access_token(str(user.id), user.email)

    return VerifyOTPResponse(
        access_token=token,
        user={
            "id": str(user.id),
            "full_name": user.full_name,
            "email": user.email,
            "mobile": user.mobile,
            "is_verified": user.is_verified,
            "created_at": user.created_at.isoformat(),
        },
    )


# ─── Development Helper (Testing Only) ──────────────────────────────────────────


@router.get(
    "/dev/get-otp/{identifier}",
    tags=["Auth - Development Only"],
    summary="[DEV ONLY] Get OTP for testing",
)
async def get_otp_dev(identifier: str):
    """
    ⚠️ DEVELOPMENT ONLY — Get the OTP for a given email/mobile for testing.
    This endpoint is disabled in production (DEBUG=false).
    
    Use this to test the OTP verification flow when email service is not available.
    """
    if not settings.DEBUG:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is only available in development mode",
        )
    
    # Import here to access the in-memory OTP storage
    from app.utils.redis_client import _memory_otps
    
    key = f"otp:{identifier}"
    otp = _memory_otps.get(key)
    
    if otp is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No OTP found for {identifier}. Did you register first?",
        )
    
    logger.warning(f"⚠️  DEV: OTP exposed for {identifier}: {otp}")
    return {
        "identifier": identifier,
        "otp": otp,
        "message": "⚠️ This is a development-only endpoint. Remove before production!"
    }
