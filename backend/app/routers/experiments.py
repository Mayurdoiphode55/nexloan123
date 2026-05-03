"""
NexLoan Experiments Router — A/B Credit Policy Testing
Create, manage, and analyze credit policy experiments.
"""

import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loan import (
    User, Loan, LoanStatus, CreditPolicyExperiment, ExperimentAssignment,
)
from app.utils.database import get_db
from app.utils.permissions import require_permission, Permission

logger = logging.getLogger("nexloan.experiments")
router = APIRouter()


class CreateExperimentRequest(BaseModel):
    name: str
    description: str = ""
    traffic_split: float = 0.5
    policy_a_min_score: int = 600
    policy_a_max_dti: float = 0.50
    policy_b_min_score: int = 550
    policy_b_max_dti: float = 0.45


@router.get("/list", summary="List all experiments")
async def list_experiments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    result = await db.execute(
        select(CreditPolicyExperiment).order_by(CreditPolicyExperiment.start_date.desc())
    )
    experiments = result.scalars().all()

    items = []
    for exp in experiments:
        # Count assignments
        a_count = await db.scalar(
            select(func.count(ExperimentAssignment.id)).where(
                ExperimentAssignment.experiment_id == exp.id,
                ExperimentAssignment.policy_group == "A",
            )
        ) or 0
        b_count = await db.scalar(
            select(func.count(ExperimentAssignment.id)).where(
                ExperimentAssignment.experiment_id == exp.id,
                ExperimentAssignment.policy_group == "B",
            )
        ) or 0

        items.append({
            "id": str(exp.id),
            "name": exp.name,
            "description": exp.description,
            "status": exp.status,
            "traffic_split": exp.traffic_split,
            "start_date": exp.start_date.isoformat() if exp.start_date else None,
            "end_date": exp.end_date.isoformat() if exp.end_date else None,
            "policy_a": {
                "min_score": exp.policy_a_min_score,
                "max_dti": exp.policy_a_max_dti,
                "assignments": a_count,
                "approval_rate": exp.policy_a_approval_rate,
                "npa_rate": exp.policy_a_npa_rate,
            },
            "policy_b": {
                "min_score": exp.policy_b_min_score,
                "max_dti": exp.policy_b_max_dti,
                "assignments": b_count,
                "approval_rate": exp.policy_b_approval_rate,
                "npa_rate": exp.policy_b_npa_rate,
            },
            "winner": exp.winner,
        })

    return items


@router.post("/create", summary="Create a new A/B experiment")
async def create_experiment(
    body: CreateExperimentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    # Check for existing active experiment
    existing = await db.execute(
        select(CreditPolicyExperiment).where(CreditPolicyExperiment.status == "ACTIVE")
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="An active experiment already exists. Conclude it first.")

    experiment = CreditPolicyExperiment(
        name=body.name,
        description=body.description,
        traffic_split=body.traffic_split,
        policy_a_min_score=body.policy_a_min_score,
        policy_a_max_dti=body.policy_a_max_dti,
        policy_b_min_score=body.policy_b_min_score,
        policy_b_max_dti=body.policy_b_max_dti,
        created_by=current_user.id,
    )
    db.add(experiment)
    await db.commit()
    await db.refresh(experiment)

    return {"id": str(experiment.id), "message": "Experiment created and active."}


@router.post("/{experiment_id}/pause", summary="Pause an active experiment")
async def pause_experiment(
    experiment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    result = await db.execute(
        select(CreditPolicyExperiment).where(CreditPolicyExperiment.id == experiment_id)
    )
    exp = result.scalar_one_or_none()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")

    exp.status = "PAUSED"
    await db.commit()
    return {"message": "Experiment paused"}


@router.post("/{experiment_id}/conclude", summary="Conclude experiment and pick winner")
async def conclude_experiment(
    experiment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    result = await db.execute(
        select(CreditPolicyExperiment).where(CreditPolicyExperiment.id == experiment_id)
    )
    exp = result.scalar_one_or_none()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")

    # Calculate results for each group
    for group in ["A", "B"]:
        assignments = await db.execute(
            select(ExperimentAssignment.loan_id).where(
                ExperimentAssignment.experiment_id == exp.id,
                ExperimentAssignment.policy_group == group,
            )
        )
        loan_ids = [row[0] for row in assignments.all()]

        if loan_ids:
            approved = await db.scalar(
                select(func.count(Loan.id)).where(
                    Loan.id.in_(loan_ids),
                    Loan.status.in_([
                        LoanStatus.APPROVED, LoanStatus.DISBURSED,
                        LoanStatus.ACTIVE, LoanStatus.CLOSED,
                    ]),
                )
            ) or 0
            approval_rate = approved / len(loan_ids)
        else:
            approval_rate = 0

        if group == "A":
            exp.policy_a_approval_rate = round(approval_rate, 4)
            exp.policy_a_npa_rate = 0  # Simplified for prototype
        else:
            exp.policy_b_approval_rate = round(approval_rate, 4)
            exp.policy_b_npa_rate = 0

    # Determine winner (lower NPA + acceptable approval rate)
    if exp.policy_a_npa_rate is not None and exp.policy_b_npa_rate is not None:
        if (exp.policy_b_npa_rate or 0) < (exp.policy_a_npa_rate or 0):
            exp.winner = "B"
        elif (exp.policy_a_npa_rate or 0) < (exp.policy_b_npa_rate or 0):
            exp.winner = "A"
        else:
            exp.winner = "INCONCLUSIVE"
    else:
        exp.winner = "INCONCLUSIVE"

    exp.status = "CONCLUDED"
    exp.end_date = datetime.utcnow()
    await db.commit()

    return {
        "winner": exp.winner,
        "policy_a_approval_rate": exp.policy_a_approval_rate,
        "policy_b_approval_rate": exp.policy_b_approval_rate,
    }


async def get_policy_for_loan(loan_id: str, db: AsyncSession) -> dict:
    """Check if an active experiment exists and assign loan to a policy group."""
    result = await db.execute(
        select(CreditPolicyExperiment).where(CreditPolicyExperiment.status == "ACTIVE")
    )
    experiment = result.scalar_one_or_none()

    if not experiment:
        return {
            "min_score": 600,
            "max_dti": 0.50,
            "policy_group": None,
            "experiment_id": None,
        }

    # Deterministic assignment based on loan_id hash
    loan_hash = int(str(loan_id).replace("-", "")[:8], 16)
    is_policy_b = (loan_hash % 100) < (experiment.traffic_split * 100)
    policy_group = "B" if is_policy_b else "A"

    assignment = ExperimentAssignment(
        experiment_id=experiment.id,
        loan_id=loan_id,
        policy_group=policy_group,
    )
    db.add(assignment)

    if policy_group == "B":
        return {
            "min_score": experiment.policy_b_min_score,
            "max_dti": experiment.policy_b_max_dti,
            "policy_group": "B",
            "experiment_id": str(experiment.id),
        }
    else:
        return {
            "min_score": experiment.policy_a_min_score,
            "max_dti": experiment.policy_a_max_dti,
            "policy_group": "A",
            "experiment_id": str(experiment.id),
        }
