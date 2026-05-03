"""
NexLoan Agent Router — DSA Module
Agent registration, dashboard, applications, commissions, admin management.
"""

import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loan import (
    User, UserRole, Loan, Agent, AgentCommission, LoanStatus,
)
from app.utils.database import get_db
from app.utils.auth import get_current_user
from app.utils.permissions import require_permission, Permission

logger = logging.getLogger("nexloan.agent")
router = APIRouter()


class AgentRegisterRequest(BaseModel):
    full_name: str
    email: str
    mobile: str
    agency_name: str | None = None


class CommissionRateRequest(BaseModel):
    commission_rate_pct: float


@router.post("/register", summary="Agent self-registration")
async def register_agent(
    body: AgentRegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    # Check if email already exists
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create user with AGENT role
    import uuid
    user = User(
        full_name=body.full_name,
        email=body.email,
        mobile=body.mobile,
        role=UserRole.AGENT.value,
        is_verified=True,
    )
    db.add(user)
    await db.flush()

    # Generate agent code
    count = await db.scalar(select(func.count(Agent.id))) or 0
    agent_code = f"DSA-{datetime.utcnow().year}-{(count + 1):04d}"

    agent = Agent(
        user_id=user.id,
        agent_code=agent_code,
        agency_name=body.agency_name,
    )
    db.add(agent)
    await db.commit()

    return {
        "user_id": str(user.id),
        "agent_code": agent_code,
        "message": "Agent registered. Awaiting admin approval.",
    }


@router.get("/dashboard", summary="Agent dashboard — performance stats")
async def agent_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Get agent record
    agent_result = await db.execute(
        select(Agent).where(Agent.user_id == current_user.id)
    )
    agent = agent_result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent profile not found")

    # Get sourced loans
    loans_result = await db.execute(
        select(Loan).where(Loan.sourced_by_agent_id == agent.id)
        .order_by(Loan.created_at.desc())
    )
    loans = loans_result.scalars().all()

    approved = [l for l in loans if l.status in [LoanStatus.APPROVED, LoanStatus.DISBURSED, LoanStatus.ACTIVE, LoanStatus.CLOSED]]
    approval_rate = len(approved) / len(loans) * 100 if loans else 0

    # Get commissions
    comm_result = await db.execute(
        select(AgentCommission).where(AgentCommission.agent_id == agent.id)
    )
    commissions = comm_result.scalars().all()
    total_earned = sum(c.commission_amount for c in commissions)
    total_paid = sum(c.commission_amount for c in commissions if c.status == "PAID")
    pending = sum(c.commission_amount for c in commissions if c.status == "PENDING")

    return {
        "agent_code": agent.agent_code,
        "agency_name": agent.agency_name,
        "kyc_verified": agent.kyc_verified,
        "is_active": agent.is_active,
        "total_applications": len(loans),
        "approved": len(approved),
        "approval_rate": round(approval_rate, 1),
        "commission_rate_pct": agent.commission_rate_pct,
        "total_commission_earned": total_earned,
        "total_commission_paid": total_paid,
        "pending_commission": pending,
        "recent_applications": [
            {
                "loan_id": str(l.id),
                "loan_number": l.loan_number,
                "amount": l.loan_amount,
                "status": l.status.value,
                "created_at": l.created_at.isoformat() if l.created_at else None,
            }
            for l in loans[:10]
        ],
    }


@router.get("/applications", summary="All loans sourced by this agent")
async def agent_applications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    agent_result = await db.execute(
        select(Agent).where(Agent.user_id == current_user.id)
    )
    agent = agent_result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent profile not found")

    loans_result = await db.execute(
        select(Loan)
        .options(selectinload(Loan.user))
        .where(Loan.sourced_by_agent_id == agent.id)
        .order_by(Loan.created_at.desc())
    )
    loans = loans_result.scalars().all()

    return [
        {
            "loan_id": str(l.id),
            "loan_number": l.loan_number,
            "borrower_name": l.user.full_name if l.user else "",
            "amount": l.loan_amount,
            "status": l.status.value,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in loans
    ]


@router.get("/commissions", summary="Agent commission records")
async def agent_commissions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    agent_result = await db.execute(
        select(Agent).where(Agent.user_id == current_user.id)
    )
    agent = agent_result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent profile not found")

    comm_result = await db.execute(
        select(AgentCommission).where(AgentCommission.agent_id == agent.id)
        .order_by(AgentCommission.created_at.desc())
    )
    commissions = comm_result.scalars().all()

    return [
        {
            "id": str(c.id),
            "loan_id": str(c.loan_id),
            "disbursed_amount": c.disbursed_amount,
            "commission_rate": c.commission_rate,
            "commission_amount": c.commission_amount,
            "status": c.status,
            "paid_at": c.paid_at.isoformat() if c.paid_at else None,
        }
        for c in commissions
    ]


# ─── Admin agent management ──────────────────────────────────────────────────


@router.get("/admin/list", summary="List all agents (admin)")
async def list_agents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    result = await db.execute(
        select(Agent).options(selectinload(Agent.user)).order_by(Agent.registered_at.desc())
    )
    agents = result.scalars().all()
    return [
        {
            "id": str(a.id),
            "agent_code": a.agent_code,
            "full_name": a.user.full_name if a.user else "",
            "email": a.user.email if a.user else "",
            "agency_name": a.agency_name,
            "commission_rate_pct": a.commission_rate_pct,
            "total_applications": a.total_applications,
            "total_disbursed": a.total_disbursed,
            "total_commission_earned": a.total_commission_earned,
            "kyc_verified": a.kyc_verified,
            "is_active": a.is_active,
            "registered_at": a.registered_at.isoformat() if a.registered_at else None,
        }
        for a in agents
    ]


@router.post("/admin/approve/{agent_id}", summary="Approve an agent (admin)")
async def approve_agent(
    agent_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent.kyc_verified = True
    agent.is_active = True
    await db.commit()
    return {"message": f"Agent {agent.agent_code} approved"}


@router.put("/admin/{agent_id}/commission-rate", summary="Set agent commission rate")
async def set_commission_rate(
    agent_id: str,
    body: CommissionRateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent.commission_rate_pct = body.commission_rate_pct
    await db.commit()
    return {"message": f"Commission rate set to {body.commission_rate_pct}%"}


@router.post("/admin/commissions/{commission_id}/approve", summary="Approve commission payment")
async def approve_commission(
    commission_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    result = await db.execute(
        select(AgentCommission).where(AgentCommission.id == commission_id)
    )
    comm = result.scalar_one_or_none()
    if not comm:
        raise HTTPException(status_code=404, detail="Commission not found")

    comm.status = "APPROVED"
    comm.approved_by = current_user.id
    await db.commit()
    return {"message": "Commission approved"}
