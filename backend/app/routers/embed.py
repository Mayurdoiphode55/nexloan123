"""
NexLoan Embedded Lending Router — API-First Mode
External partner endpoints authenticated via API key.
"""

import hashlib
import hmac
import json
import logging
import secrets
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Header, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loan import APIClient, Loan, LoanStatus, User
from app.utils.database import get_db
from app.utils.permissions import require_permission, Permission
from app.services.credit_score import calculate_credit_score
from app.services.emi_engine import calculate_emi
from app.config import settings

logger = logging.getLogger("nexloan.embed")
router = APIRouter()


# ─── API Key Auth Dependency ─────────────────────────────────────────────────


async def get_api_client(
    x_nexloan_key: str = Header(..., alias="X-NexLoan-Key"),
    db: AsyncSession = Depends(get_db),
) -> APIClient:
    result = await db.execute(
        select(APIClient).where(APIClient.api_key == x_nexloan_key, APIClient.is_active == True)
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=401, detail="Invalid or inactive API key")
    if client.requests_this_month >= client.monthly_request_limit:
        raise HTTPException(status_code=429, detail="Monthly request limit exceeded")
    client.requests_this_month += 1
    return client


# ─── Embedded API Endpoints ──────────────────────────────────────────────────


class EligibilityRequest(BaseModel):
    name: str
    mobile: str
    income: float
    employment_type: str = "SALARIED"
    existing_emi: float = 0
    loan_amount: float
    tenure_months: int = 36
    purpose: str = "Personal"


class CreateApplicationRequest(BaseModel):
    name: str
    email: str
    mobile: str
    income: float
    employment_type: str = "SALARIED"
    existing_emi: float = 0
    loan_amount: float
    tenure_months: int = 36
    purpose: str = "Personal"


@router.post("/eligibility-check", summary="Check loan eligibility (embedded)")
async def eligibility_check(
    body: EligibilityRequest,
    api_client: APIClient = Depends(get_api_client),
    db: AsyncSession = Depends(get_db),
):
    scoring = calculate_credit_score(
        monthly_income=body.income,
        existing_emi=body.existing_emi,
        loan_amount=body.loan_amount,
        tenure_months=body.tenure_months,
        employment_type=body.employment_type,
    )

    emi = calculate_emi(body.loan_amount, scoring["interest_rate"], body.tenure_months)

    apply_url = f"{settings.FRONTEND_URL}/apply?partner={api_client.client_name}"

    await db.commit()

    return {
        "eligible": scoring["is_eligible"],
        "credit_score": scoring["score"],
        "offered_rate": scoring["interest_rate"],
        "emi_amount": round(emi, 2),
        "apply_url": apply_url,
        "partner": api_client.client_name,
    }


@router.post("/create-application", summary="Create pre-filled application (embedded)")
async def create_application(
    body: CreateApplicationRequest,
    api_client: APIClient = Depends(get_api_client),
    db: AsyncSession = Depends(get_db),
):
    # Check if user exists or create
    user_result = await db.execute(select(User).where(User.email == body.email))
    user = user_result.scalar_one_or_none()

    if not user:
        user = User(
            full_name=body.name,
            email=body.email,
            mobile=body.mobile,
            is_verified=False,
        )
        db.add(user)
        await db.flush()

    # Generate loan number
    count = await db.execute(select(Loan))
    loan_count = len(count.scalars().all()) + 1
    loan_number = f"NL-{datetime.utcnow().year}-{loan_count:05d}"

    loan = Loan(
        user_id=user.id,
        loan_number=loan_number,
        status=LoanStatus.INQUIRY,
        loan_amount=body.loan_amount,
        tenure_months=body.tenure_months,
        purpose=body.purpose,
        monthly_income=body.income,
        employment_type=body.employment_type,
        existing_emi=body.existing_emi,
    )
    db.add(loan)
    await db.commit()
    await db.refresh(loan)

    return {
        "loan_id": str(loan.id),
        "loan_number": loan.loan_number,
        "apply_url": f"{settings.FRONTEND_URL}/apply?loan={loan.loan_number}",
    }


@router.get("/loan-status/{loan_id}", summary="Check loan status (embedded)")
async def loan_status(
    loan_id: str,
    api_client: APIClient = Depends(get_api_client),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Loan).where(Loan.id == loan_id))
    loan = result.scalar_one_or_none()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    # Next due date
    next_emi = None
    if loan.emi_schedule:
        pending = [e for e in loan.emi_schedule if e.status.value == "PENDING"]
        if pending:
            next_emi = min(pending, key=lambda e: e.due_date)

    await db.commit()

    return {
        "loan_id": str(loan.id),
        "loan_number": loan.loan_number,
        "status": loan.status.value,
        "disbursed_amount": loan.disbursed_amount,
        "emi_amount": loan.emi_amount,
        "next_due_date": next_emi.due_date.isoformat() if next_emi else None,
    }


# ─── Admin: API Client Management ───────────────────────────────────────────


class CreateClientRequest(BaseModel):
    client_name: str
    webhook_url: str | None = None
    allowed_origins: list[str] = []
    monthly_request_limit: int = 1000


@router.get("/admin/clients", summary="List API clients (admin)")
async def list_clients(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    result = await db.execute(select(APIClient).order_by(APIClient.created_at.desc()))
    clients = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "client_name": c.client_name,
            "api_key_masked": c.api_key[:12] + "..." if c.api_key else "",
            "webhook_url": c.webhook_url,
            "is_active": c.is_active,
            "monthly_request_limit": c.monthly_request_limit,
            "requests_this_month": c.requests_this_month,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in clients
    ]


@router.post("/admin/clients", summary="Create API client (admin)")
async def create_client(
    body: CreateClientRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    api_key = f"nxl_live_{secrets.token_hex(16)}"

    client = APIClient(
        client_name=body.client_name,
        api_key=api_key,
        webhook_url=body.webhook_url,
        allowed_origins=body.allowed_origins,
        monthly_request_limit=body.monthly_request_limit,
    )
    db.add(client)
    await db.commit()
    await db.refresh(client)

    return {
        "id": str(client.id),
        "client_name": client.client_name,
        "api_key": api_key,
        "message": "API client created. Store the API key securely — it won't be shown again.",
    }


@router.delete("/admin/clients/{client_id}", summary="Deactivate API client")
async def deactivate_client(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    result = await db.execute(select(APIClient).where(APIClient.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    client.is_active = False
    await db.commit()
    return {"message": f"Client {client.client_name} deactivated"}
