"""
NexLoan Config Router — Public tenant config endpoint.
GET /api/config — Returns safe subset of tenant config (no auth).
Cached in Redis for 5 minutes.
"""

import json
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.utils.database import get_db
from app.models.loan import TenantConfig
from app.config import settings

logger = logging.getLogger("nexloan.config")

router = APIRouter()


class PublicConfigResponse(BaseModel):
    client_name: str
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    primary_color: str
    secondary_color: str
    font_family: str
    tagline: Optional[str] = None
    support_email: Optional[str] = None
    support_phone: Optional[str] = None
    registered_name: Optional[str] = None
    rbi_registration: Optional[str] = None
    terms_url: Optional[str] = None
    privacy_url: Optional[str] = None
    announcement_text: Optional[str] = None
    announcement_active: bool = False
    announcement_color: str = "#F59E0B"
    # Feature flags (safe to expose)
    feature_preclosure: bool = True
    feature_emi_pause: bool = True
    feature_loan_comparison: bool = True
    feature_collateral_loans: bool = False
    feature_support_chat: bool = True
    # Financial limits (safe to expose)
    max_loan_amount: float = 2500000
    min_loan_amount: float = 50000
    max_tenure_months: int = 60
    min_tenure_months: int = 12
    collateral_policy: dict = {}


@router.get("", response_model=PublicConfigResponse)
async def get_public_config(db: AsyncSession = Depends(get_db)):
    """
    PUBLIC endpoint (no auth).
    Returns safe subset of tenant config for frontend.
    Frontend calls this on every page load.
    """
    # Try Redis cache first
    try:
        from app.utils.redis_client import get_redis
        redis = get_redis()
        if redis:
            cached = await redis.get(f"tenant_config:{settings.TENANT_ID}")
            if cached:
                return PublicConfigResponse(**json.loads(cached))
    except Exception:
        pass

    # Fetch from DB
    result = await db.execute(
        select(TenantConfig).where(TenantConfig.tenant_id == settings.TENANT_ID)
    )
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant config not found")

    response = PublicConfigResponse(
        client_name=tenant.client_name,
        logo_url=tenant.logo_url,
        favicon_url=tenant.favicon_url,
        primary_color=tenant.primary_color or "#1A1A2E",
        secondary_color=tenant.secondary_color or "#F5F5F5",
        font_family=tenant.font_family or "Inter",
        tagline=tenant.tagline,
        support_email=tenant.support_email,
        support_phone=tenant.support_phone,
        registered_name=tenant.registered_name,
        rbi_registration=tenant.rbi_registration,
        terms_url=tenant.terms_url,
        privacy_url=tenant.privacy_url,
        announcement_text=tenant.announcement_text,
        announcement_active=tenant.announcement_active or False,
        announcement_color=tenant.announcement_color or "#F59E0B",
        feature_preclosure=tenant.feature_preclosure if tenant.feature_preclosure is not None else True,
        feature_emi_pause=tenant.feature_emi_pause if tenant.feature_emi_pause is not None else True,
        feature_loan_comparison=tenant.feature_loan_comparison if tenant.feature_loan_comparison is not None else True,
        feature_collateral_loans=tenant.feature_collateral_loans or False,
        feature_support_chat=tenant.feature_support_chat if tenant.feature_support_chat is not None else True,
        max_loan_amount=tenant.max_loan_amount or 2500000,
        min_loan_amount=tenant.min_loan_amount or 50000,
        max_tenure_months=tenant.max_tenure_months or 60,
        min_tenure_months=tenant.min_tenure_months or 12,
        collateral_policy=tenant.collateral_policy or {},
    )

    # Cache in Redis for 5 minutes
    try:
        from app.utils.redis_client import get_redis
        redis = get_redis()
        if redis:
            await redis.setex(
                f"tenant_config:{settings.TENANT_ID}",
                300,
                json.dumps(response.model_dump()),
            )
    except Exception:
        pass

    return response


# ─── Admin Tenant Config Endpoints ──────────────────────────────────────────


class TenantConfigUpdate(BaseModel):
    client_name: Optional[str] = None
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    font_family: Optional[str] = None
    tagline: Optional[str] = None
    support_email: Optional[str] = None
    support_phone: Optional[str] = None
    website_url: Optional[str] = None
    terms_url: Optional[str] = None
    privacy_url: Optional[str] = None
    registered_name: Optional[str] = None
    rbi_registration: Optional[str] = None
    email_from_name: Optional[str] = None
    email_from_address: Optional[str] = None
    email_header_color: Optional[str] = None
    feature_preclosure: Optional[bool] = None
    feature_emi_pause: Optional[bool] = None
    feature_loan_comparison: Optional[bool] = None
    feature_collateral_loans: Optional[bool] = None
    feature_support_chat: Optional[bool] = None
    default_preclosure_rate: Optional[float] = None
    preclosure_free_months: Optional[int] = None
    preclosure_early_charge_rate: Optional[float] = None
    preclosure_link_validity_hours: Optional[int] = None
    max_loan_amount: Optional[float] = None
    min_loan_amount: Optional[float] = None
    max_tenure_months: Optional[int] = None
    min_tenure_months: Optional[int] = None
    announcement_text: Optional[str] = None
    announcement_active: Optional[bool] = None
    announcement_color: Optional[str] = None
    collateral_policy: Optional[dict] = None
    departments: Optional[list] = None
    verification_parameters: Optional[dict] = None
    auto_monthly_statement: Optional[bool] = None


@router.get("/admin/tenant-config")
async def get_admin_tenant_config(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(None),  # Will be overridden by require_role in main.py
):
    """Returns full tenant config (admin only)."""
    from app.utils.auth import get_current_user, require_role
    result = await db.execute(
        select(TenantConfig).where(TenantConfig.tenant_id == settings.TENANT_ID)
    )
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant config not found")

    return {
        "tenant_id": tenant.tenant_id,
        "client_name": tenant.client_name,
        "logo_url": tenant.logo_url,
        "favicon_url": tenant.favicon_url,
        "primary_color": tenant.primary_color,
        "secondary_color": tenant.secondary_color,
        "font_family": tenant.font_family,
        "tagline": tenant.tagline,
        "support_email": tenant.support_email,
        "support_phone": tenant.support_phone,
        "website_url": tenant.website_url,
        "terms_url": tenant.terms_url,
        "privacy_url": tenant.privacy_url,
        "registered_name": tenant.registered_name,
        "rbi_registration": tenant.rbi_registration,
        "email_from_name": tenant.email_from_name,
        "email_from_address": tenant.email_from_address,
        "email_header_color": tenant.email_header_color,
        "feature_preclosure": tenant.feature_preclosure,
        "feature_emi_pause": tenant.feature_emi_pause,
        "feature_loan_comparison": tenant.feature_loan_comparison,
        "feature_collateral_loans": tenant.feature_collateral_loans,
        "feature_support_chat": tenant.feature_support_chat,
        "default_preclosure_rate": tenant.default_preclosure_rate,
        "preclosure_free_months": tenant.preclosure_free_months,
        "preclosure_early_charge_rate": tenant.preclosure_early_charge_rate,
        "preclosure_link_validity_hours": tenant.preclosure_link_validity_hours,
        "max_loan_amount": tenant.max_loan_amount,
        "min_loan_amount": tenant.min_loan_amount,
        "max_tenure_months": tenant.max_tenure_months,
        "min_tenure_months": tenant.min_tenure_months,
        "announcement_text": tenant.announcement_text,
        "announcement_active": tenant.announcement_active,
        "announcement_color": tenant.announcement_color,
        "collateral_policy": tenant.collateral_policy,
        "departments": tenant.departments,
        "verification_parameters": tenant.verification_parameters,
        "auto_monthly_statement": tenant.auto_monthly_statement,
    }


@router.put("/admin/tenant-config")
async def update_tenant_config(
    update: TenantConfigUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Updates tenant config fields (admin only). Invalidates cache."""
    result = await db.execute(
        select(TenantConfig).where(TenantConfig.tenant_id == settings.TENANT_ID)
    )
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant config not found")

    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tenant, field, value)

    await db.commit()
    await db.refresh(tenant)

    # Invalidate Redis cache
    try:
        from app.utils.redis_client import get_redis
        redis = get_redis()
        if redis:
            await redis.delete(f"tenant_config:{settings.TENANT_ID}")
    except Exception:
        pass

    logger.info(f"✅ Tenant config updated: {list(update_data.keys())}")
    return {"message": "Tenant config updated", "updated_fields": list(update_data.keys())}
