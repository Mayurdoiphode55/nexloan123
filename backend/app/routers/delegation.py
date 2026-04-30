"""
NexLoan Admin Delegation API — Phase 2
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List
from sqlalchemy import select
from datetime import datetime

from app.utils.auth import get_current_user
from app.utils.database import AsyncSessionLocal
from app.utils.permissions import require_permission, Permission
from app.models.loan import AdminDelegation, User

router = APIRouter()


class DelegationCreate(BaseModel):
    delegate_id: str
    permissions: List[str]
    start_date: str
    end_date: str


@router.post("/create")
async def create_delegation(data: DelegationCreate, current_user=Depends(require_permission(Permission.DELEGATE_ADMIN))):
    async with AsyncSessionLocal() as db:
        delegate = (await db.execute(select(User).where(User.id == data.delegate_id))).scalar_one_or_none()
        if not delegate:
            raise HTTPException(status_code=404, detail="Delegate user not found")
        if delegate.role not in ("ADMIN", "SUPER_ADMIN", "LOAN_OFFICER"):
            raise HTTPException(status_code=400, detail="Delegate must be admin or officer")
        valid_perms = [p.value for p in Permission]
        for p in data.permissions:
            if p not in valid_perms:
                raise HTTPException(status_code=400, detail=f"Invalid permission: {p}")
        start_dt = datetime.fromisoformat(data.start_date)
        end_dt = datetime.fromisoformat(data.end_date)
        if end_dt <= start_dt:
            raise HTTPException(status_code=400, detail="End date must be after start date")
        d = AdminDelegation(delegator_id=current_user["user_id"], delegate_id=data.delegate_id,
                            delegated_permissions=data.permissions, start_date=start_dt, end_date=end_dt)
        db.add(d)
        await db.commit()
        await db.refresh(d)
        return {"message": "Delegation created", "delegation_id": str(d.id)}


@router.get("/active")
async def get_active_delegations(current_user=Depends(require_permission(Permission.DELEGATE_ADMIN))):
    async with AsyncSessionLocal() as db:
        now = datetime.utcnow()
        result = await db.execute(select(AdminDelegation).where(AdminDelegation.is_active == True).order_by(AdminDelegation.created_at.desc()))
        items = []
        for d in result.scalars().all():
            delegator = (await db.execute(select(User.full_name).where(User.id == d.delegator_id))).scalar() or "Unknown"
            delegate = (await db.execute(select(User.full_name).where(User.id == d.delegate_id))).scalar() or "Unknown"
            items.append({"id": str(d.id), "delegator_name": delegator, "delegate_name": delegate,
                          "permissions": d.delegated_permissions or [], "start_date": d.start_date.isoformat(),
                          "end_date": d.end_date.isoformat(), "is_active": d.is_active and d.start_date <= now <= d.end_date,
                          "created_at": d.created_at.isoformat()})
        return items


@router.delete("/{delegation_id}")
async def revoke_delegation(delegation_id: str, current_user=Depends(require_permission(Permission.DELEGATE_ADMIN))):
    async with AsyncSessionLocal() as db:
        d = (await db.execute(select(AdminDelegation).where(AdminDelegation.id == delegation_id))).scalar_one_or_none()
        if not d:
            raise HTTPException(status_code=404, detail="Delegation not found")
        if str(d.delegator_id) != current_user["user_id"] and current_user.get("role") != "SUPER_ADMIN":
            raise HTTPException(status_code=403, detail="Only delegator can revoke")
        d.is_active = False
        await db.commit()
        return {"message": "Delegation revoked"}
