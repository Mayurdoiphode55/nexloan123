"""
NexLoan Announcements API — Phase 2
Admin-created announcements displayed on borrower dashboard.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import select
from datetime import datetime

from app.utils.auth import get_current_user
from app.utils.database import AsyncSessionLocal
from app.utils.permissions import require_permission, Permission
from app.models.loan import Announcement

router = APIRouter()


class AnnouncementCreate(BaseModel):
    title: str
    body: str
    image_url: Optional[str] = None
    expiry_date: Optional[str] = None


@router.post("/create")
async def create_announcement(data: AnnouncementCreate, current_user=Depends(require_permission(Permission.ANNOUNCEMENT_CREATE))):
    async with AsyncSessionLocal() as db:
        a = Announcement(
            title=data.title, body=data.body, image_url=data.image_url,
            expiry_date=datetime.fromisoformat(data.expiry_date) if data.expiry_date else None,
            created_by=current_user["user_id"],
        )
        db.add(a)
        await db.commit()
        await db.refresh(a)
        return {"message": "Announcement created", "id": str(a.id)}


@router.get("/active")
async def get_active_announcements():
    """Public endpoint — get active, non-expired announcements."""
    async with AsyncSessionLocal() as db:
        now = datetime.utcnow()
        result = await db.execute(
            select(Announcement).where(
                Announcement.is_active == True,
            ).order_by(Announcement.created_at.desc())
        )
        items = []
        for a in result.scalars().all():
            if a.expiry_date and a.expiry_date < now:
                continue
            items.append({
                "id": str(a.id), "title": a.title, "body": a.body,
                "image_url": a.image_url, "expiry_date": a.expiry_date.isoformat() if a.expiry_date else None,
                "created_at": a.created_at.isoformat(),
            })
        return items


@router.get("/all")
async def get_all_announcements(current_user=Depends(require_permission(Permission.MANAGE_ANNOUNCEMENTS))):
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Announcement).order_by(Announcement.created_at.desc()))
        return [{"id": str(a.id), "title": a.title, "body": a.body, "image_url": a.image_url,
                 "is_active": a.is_active, "expiry_date": a.expiry_date.isoformat() if a.expiry_date else None,
                 "created_at": a.created_at.isoformat()} for a in result.scalars().all()]


@router.delete("/{announcement_id}")
async def delete_announcement(announcement_id: str, current_user=Depends(require_permission(Permission.MANAGE_ANNOUNCEMENTS))):
    async with AsyncSessionLocal() as db:
        a = (await db.execute(select(Announcement).where(Announcement.id == announcement_id))).scalar_one_or_none()
        if not a:
            raise HTTPException(status_code=404, detail="Not found")
        a.is_active = False
        await db.commit()
        return {"message": "Announcement deactivated"}
