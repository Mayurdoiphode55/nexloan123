"""
NexLoan Risk Router — Fraud Flags, Blacklist, Early Warning, Rate Rules
Admin endpoints for risk management features.
"""

import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loan import (
    User, Loan, FraudFlag, Blacklist, EarlyWarningFlag, RateRule,
)
from app.utils.database import get_db
from app.utils.permissions import require_permission, Permission

logger = logging.getLogger("nexloan.risk")
router = APIRouter()


# ─── RATE RULES ──────────────────────────────────────────────────────────────


class RateRuleRequest(BaseModel):
    name: str
    priority: int = 0
    condition_loan_purpose: str | None = None
    condition_score_min: int | None = None
    condition_score_max: int | None = None
    condition_amount_min: float | None = None
    condition_amount_max: float | None = None
    condition_channel: str | None = None
    condition_valid_from: str | None = None
    condition_valid_until: str | None = None
    rate_override: float | None = None
    rate_adjustment: float | None = None
    description: str | None = None


@router.get("/rate-rules", summary="List all rate rules")
async def list_rate_rules(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    result = await db.execute(
        select(RateRule).order_by(RateRule.priority.desc())
    )
    rules = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "name": r.name,
            "is_active": r.is_active,
            "priority": r.priority,
            "condition_loan_purpose": r.condition_loan_purpose,
            "condition_score_min": r.condition_score_min,
            "condition_score_max": r.condition_score_max,
            "condition_amount_min": r.condition_amount_min,
            "condition_amount_max": r.condition_amount_max,
            "condition_channel": r.condition_channel,
            "condition_valid_from": r.condition_valid_from.isoformat() if r.condition_valid_from else None,
            "condition_valid_until": r.condition_valid_until.isoformat() if r.condition_valid_until else None,
            "rate_override": r.rate_override,
            "rate_adjustment": r.rate_adjustment,
            "description": r.description,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rules
    ]


@router.post("/rate-rules/create", summary="Create a new rate rule")
async def create_rate_rule(
    body: RateRuleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    rule = RateRule(
        name=body.name,
        priority=body.priority,
        condition_loan_purpose=body.condition_loan_purpose,
        condition_score_min=body.condition_score_min,
        condition_score_max=body.condition_score_max,
        condition_amount_min=body.condition_amount_min,
        condition_amount_max=body.condition_amount_max,
        condition_channel=body.condition_channel,
        condition_valid_from=datetime.fromisoformat(body.condition_valid_from) if body.condition_valid_from else None,
        condition_valid_until=datetime.fromisoformat(body.condition_valid_until) if body.condition_valid_until else None,
        rate_override=body.rate_override,
        rate_adjustment=body.rate_adjustment,
        description=body.description,
        created_by=current_user.id,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return {"id": str(rule.id), "message": "Rate rule created"}


@router.put("/rate-rules/{rule_id}", summary="Update a rate rule")
async def update_rate_rule(
    rule_id: str,
    body: RateRuleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    result = await db.execute(select(RateRule).where(RateRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    for field in ["name", "priority", "condition_loan_purpose", "condition_score_min",
                   "condition_score_max", "condition_amount_min", "condition_amount_max",
                   "condition_channel", "rate_override", "rate_adjustment", "description"]:
        val = getattr(body, field, None)
        if val is not None:
            setattr(rule, field, val)

    if body.condition_valid_from:
        rule.condition_valid_from = datetime.fromisoformat(body.condition_valid_from)
    if body.condition_valid_until:
        rule.condition_valid_until = datetime.fromisoformat(body.condition_valid_until)

    await db.commit()
    return {"message": "Rule updated"}


@router.delete("/rate-rules/{rule_id}", summary="Soft delete rate rule")
async def delete_rate_rule(
    rule_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    result = await db.execute(select(RateRule).where(RateRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    rule.is_active = False
    await db.commit()
    return {"message": "Rule deactivated"}


@router.post("/rate-rules/{rule_id}/toggle", summary="Toggle rule active/inactive")
async def toggle_rate_rule(
    rule_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    result = await db.execute(select(RateRule).where(RateRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    rule.is_active = not rule.is_active
    await db.commit()
    return {"is_active": rule.is_active}


# ─── FRAUD FLAGS ─────────────────────────────────────────────────────────────


class ResolveRequest(BaseModel):
    resolution_note: str


@router.get("/fraud-flags", summary="List unresolved fraud flags")
async def list_fraud_flags(
    severity: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    query = select(FraudFlag).where(FraudFlag.is_resolved == False).order_by(FraudFlag.created_at.desc())
    if severity:
        query = query.where(FraudFlag.severity == severity)

    result = await db.execute(query)
    flags = result.scalars().all()

    items = []
    for f in flags:
        loan_result = await db.execute(select(Loan).where(Loan.id == f.loan_id))
        loan = loan_result.scalar_one_or_none()
        items.append({
            "id": str(f.id),
            "loan_id": str(f.loan_id),
            "loan_number": loan.loan_number if loan else "",
            "flag_type": f.flag_type,
            "severity": f.severity,
            "description": f.description,
            "is_resolved": f.is_resolved,
            "created_at": f.created_at.isoformat() if f.created_at else None,
        })
    return items


@router.post("/fraud-flags/{flag_id}/resolve", summary="Resolve a fraud flag")
async def resolve_fraud_flag(
    flag_id: str,
    body: ResolveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    result = await db.execute(select(FraudFlag).where(FraudFlag.id == flag_id))
    flag = result.scalar_one_or_none()
    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found")

    flag.is_resolved = True
    flag.resolved_by = current_user.id
    flag.resolution_note = body.resolution_note
    await db.commit()
    return {"message": "Flag resolved"}


@router.get("/fraud-stats", summary="Fraud statistics summary")
async def fraud_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    # By type
    type_result = await db.execute(
        select(FraudFlag.flag_type, func.count(FraudFlag.id))
        .group_by(FraudFlag.flag_type)
    )
    by_type = {row[0]: row[1] for row in type_result.all()}

    # By severity
    sev_result = await db.execute(
        select(FraudFlag.severity, func.count(FraudFlag.id))
        .group_by(FraudFlag.severity)
    )
    by_severity = {row[0]: row[1] for row in sev_result.all()}

    total = await db.scalar(select(func.count(FraudFlag.id))) or 0
    unresolved = await db.scalar(
        select(func.count(FraudFlag.id)).where(FraudFlag.is_resolved == False)
    ) or 0

    return {"total": total, "unresolved": unresolved, "by_type": by_type, "by_severity": by_severity}


# ─── BLACKLIST ───────────────────────────────────────────────────────────────


class BlacklistAddRequest(BaseModel):
    identifier_type: str  # PAN, AADHAAR, MOBILE, EMAIL, BANK_ACCOUNT
    identifier_value: str
    reason: str


@router.get("/blacklist", summary="List active blacklist entries")
async def list_blacklist(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    result = await db.execute(
        select(Blacklist).where(Blacklist.is_active == True).order_by(Blacklist.created_at.desc())
    )
    entries = result.scalars().all()
    return [
        {
            "id": str(b.id),
            "identifier_type": b.identifier_type,
            "identifier_value": b.identifier_value,
            "reason": b.reason,
            "created_at": b.created_at.isoformat() if b.created_at else None,
        }
        for b in entries
    ]


@router.post("/blacklist/add", summary="Add to blacklist")
async def add_to_blacklist(
    body: BlacklistAddRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    entry = Blacklist(
        identifier_type=body.identifier_type,
        identifier_value=body.identifier_value,
        reason=body.reason,
        added_by=current_user.id,
    )
    db.add(entry)
    await db.commit()
    return {"message": "Added to blacklist"}


@router.delete("/blacklist/{entry_id}", summary="Remove from blacklist")
async def remove_from_blacklist(
    entry_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    result = await db.execute(select(Blacklist).where(Blacklist.id == entry_id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    entry.is_active = False
    await db.commit()
    return {"message": "Removed from blacklist"}


# ─── EARLY WARNING ───────────────────────────────────────────────────────────


@router.get("/early-warning", summary="List early warning flags")
async def list_early_warnings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    result = await db.execute(
        select(EarlyWarningFlag)
        .where(EarlyWarningFlag.is_resolved == False)
        .order_by(EarlyWarningFlag.risk_score.desc())
    )
    flags = result.scalars().all()

    items = []
    for f in flags:
        loan_result = await db.execute(
            select(Loan).where(Loan.id == f.loan_id)
        )
        loan = loan_result.scalar_one_or_none()
        user_result = await db.execute(select(User).where(User.id == f.user_id))
        user = user_result.scalar_one_or_none()

        items.append({
            "id": str(f.id),
            "loan_id": str(f.loan_id),
            "loan_number": loan.loan_number if loan else "",
            "borrower_name": user.full_name if user else "",
            "risk_score": f.risk_score,
            "risk_label": f.risk_label,
            "prediction_basis": f.prediction_basis,
            "ai_analysis": f.ai_analysis,
            "action_taken": f.action_taken,
            "created_at": f.created_at.isoformat() if f.created_at else None,
        })
    return items


@router.post("/early-warning/{flag_id}/resolve", summary="Resolve early warning flag")
async def resolve_early_warning(
    flag_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    result = await db.execute(
        select(EarlyWarningFlag).where(EarlyWarningFlag.id == flag_id)
    )
    flag = result.scalar_one_or_none()
    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found")
    flag.is_resolved = True
    await db.commit()
    return {"message": "Early warning resolved"}


# ─── BENCHMARK REPORTS ───────────────────────────────────────────────────────


@router.get("/reports/benchmark", summary="Generate benchmark report for a month")
async def get_benchmark_report(
    month: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    from app.services.benchmark_service import calculate_monthly_metrics, generate_benchmark_html, INDUSTRY_BENCHMARKS

    metrics = await calculate_monthly_metrics(db, month)
    html = generate_benchmark_html(metrics, INDUSTRY_BENCHMARKS)

    return {
        "metrics": metrics,
        "benchmarks": INDUSTRY_BENCHMARKS,
        "html_report": html,
    }
