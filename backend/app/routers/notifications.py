"""
NexLoan Notifications Router — In-App Notification Bell System
Provides CRUD endpoints for user notifications (EMI reminders, loan updates, etc.)
"""

import logging
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.database import get_db
from app.utils.auth import get_current_user

logger = logging.getLogger("nexloan.notifications")

router = APIRouter()


@router.get("/")
async def list_notifications(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    unread_only: bool = Query(False),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List the current user's notifications (newest first)."""
    user_id = str(current_user["id"])

    where_clause = "WHERE n.user_id = :user_id"
    if unread_only:
        where_clause += " AND n.is_read = false"

    query = f"""
        SELECT n.id, n.user_id, n.loan_id, n.type, n.title, n.message, n.is_read, n.created_at
        FROM notifications n
        {where_clause}
        ORDER BY n.created_at DESC
        LIMIT :limit OFFSET :offset
    """
    rows = (await db.execute(
        text(query), {"user_id": user_id, "limit": limit, "offset": offset}
    )).mappings().all()

    return {
        "notifications": [
            {
                "id": str(r["id"]),
                "user_id": str(r["user_id"]),
                "loan_id": str(r["loan_id"]) if r["loan_id"] else None,
                "type": r["type"],
                "title": r["title"],
                "message": r["message"],
                "is_read": r["is_read"],
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            }
            for r in rows
        ],
        "count": len(rows),
    }


@router.get("/unread-count")
async def get_unread_count(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get count of unread notifications for the bell badge."""
    user_id = str(current_user["id"])
    result = await db.execute(
        text("SELECT COUNT(*) as cnt FROM notifications WHERE user_id = :user_id AND is_read = false"),
        {"user_id": user_id},
    )
    count = result.scalar() or 0
    return {"count": count}


@router.put("/{notification_id}/read")
async def mark_as_read(
    notification_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a single notification as read."""
    user_id = str(current_user["id"])
    result = await db.execute(
        text("UPDATE notifications SET is_read = true WHERE id = :nid AND user_id = :uid"),
        {"nid": notification_id, "uid": user_id},
    )
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Marked as read"}


@router.put("/read-all")
async def mark_all_as_read(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark all notifications as read for the current user."""
    user_id = str(current_user["id"])
    result = await db.execute(
        text("UPDATE notifications SET is_read = true WHERE user_id = :uid AND is_read = false"),
        {"uid": user_id},
    )
    await db.commit()
    return {"message": f"Marked {result.rowcount} notifications as read"}


# ─── Helper: Create Notification (used by other services) ────────────────────


async def create_notification(
    db: AsyncSession,
    user_id: str,
    type: str,
    title: str,
    message: str,
    loan_id: Optional[str] = None,
) -> None:
    """Insert a new notification for a user. Called by reminder_service, etc."""
    await db.execute(
        text("""
            INSERT INTO notifications (id, user_id, loan_id, type, title, message, is_read, created_at)
            VALUES (gen_random_uuid(), :user_id, :loan_id, :type, :title, :message, false, NOW())
        """),
        {
            "user_id": user_id,
            "loan_id": loan_id,
            "type": type,
            "title": title,
            "message": message,
        },
    )
    await db.commit()
