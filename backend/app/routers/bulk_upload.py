"""
NexLoan Bulk Upload Router — CSV Bulk Loan Processing
POST /process — upload CSV, run eligibility, return results.
"""

import csv
import io
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loan import User, BulkUploadJob
from app.utils.database import get_db
from app.utils.permissions import require_permission, Permission
from app.services.credit_score import calculate_credit_score

logger = logging.getLogger("nexloan.bulk_upload")
router = APIRouter()


@router.post("/process", summary="Process CSV of borrowers with eligibility check")
async def process_bulk_upload(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    content = await file.read()
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))

    job = BulkUploadJob(
        uploaded_by=current_user.id,
        filename=file.filename,
    )
    db.add(job)
    await db.flush()

    results = []
    for i, row in enumerate(reader):
        job.total_rows = i + 1

        try:
            scoring = calculate_credit_score(
                monthly_income=float(row.get("monthly_income", 0)),
                existing_emi=float(row.get("existing_emi", 0)),
                loan_amount=float(row.get("loan_amount", 0)),
                tenure_months=int(row.get("tenure_months", 36)),
                employment_type=row.get("employment_type", "SALARIED"),
                age=int(row.get("age", 30)),
            )

            from app.services.emi_engine import calculate_emi
            emi = calculate_emi(
                float(row.get("loan_amount", 0)),
                scoring["interest_rate"],
                int(row.get("tenure_months", 36)),
            )

            results.append({
                **row,
                "eligible": scoring["is_eligible"],
                "credit_score": scoring["score"],
                "interest_rate": scoring["interest_rate"],
                "emi_amount": round(emi, 2),
                "rejection_reason": "" if scoring["is_eligible"] else "Score or DTI below threshold",
                "verdict": "ELIGIBLE" if scoring["is_eligible"] else "INELIGIBLE",
            })

            if scoring["is_eligible"]:
                job.eligible_count += 1
            else:
                job.ineligible_count += 1

        except Exception as e:
            results.append({**row, "verdict": "ERROR", "error": str(e)})

        job.processed_rows = i + 1

    job.status = "COMPLETED"
    job.completed_at = datetime.utcnow()
    await db.commit()

    return {
        "job_id": str(job.id),
        "total": job.total_rows,
        "eligible": job.eligible_count,
        "ineligible": job.ineligible_count,
        "results": results,
    }


@router.get("/jobs", summary="List bulk upload jobs")
async def list_jobs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    result = await db.execute(
        select(BulkUploadJob).order_by(BulkUploadJob.created_at.desc()).limit(20)
    )
    jobs = result.scalars().all()
    return [
        {
            "id": str(j.id),
            "filename": j.filename,
            "total_rows": j.total_rows,
            "eligible_count": j.eligible_count,
            "ineligible_count": j.ineligible_count,
            "status": j.status,
            "created_at": j.created_at.isoformat() if j.created_at else None,
        }
        for j in jobs
    ]


@router.get("/template", summary="Download CSV template")
async def get_template():
    from fastapi.responses import StreamingResponse
    csv_content = "full_name,email,mobile,monthly_income,employment_type,existing_emi,loan_amount,tenure_months,loan_purpose\n"
    csv_content += "Priya Sharma,priya@example.com,9876543210,75000,SALARIED,5000,300000,36,Medical\n"
    csv_content += "Rahul Mehta,rahul@example.com,9876543211,45000,BUSINESS,8000,200000,24,Education\n"

    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=bulk_upload_template.csv"},
    )
