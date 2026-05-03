"""
NexLoan Benchmark Service — Monthly Performance Reports
Generates and emails benchmark reports comparing client metrics vs industry.
"""

import logging
from datetime import datetime, timedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loan import Loan, LoanStatus, EMISchedule, PaymentStatus, CollectionsCase
from app.utils.database import AsyncSessionLocal

logger = logging.getLogger("nexloan.benchmark")

# Industry benchmarks (hardcoded for prototype)
INDUSTRY_BENCHMARKS = {
    "approval_rate": 0.58,
    "npa_rate": 0.021,
    "avg_processing_days": 2.3,
    "collection_efficiency": 0.92,
}


async def calculate_monthly_metrics(db: AsyncSession, month: str | None = None) -> dict:
    """Calculate platform metrics for a given month (default: last month)."""
    if month:
        year, mon = map(int, month.split("-"))
    else:
        last_month = datetime.utcnow().replace(day=1) - timedelta(days=1)
        year, mon = last_month.year, last_month.month

    start = datetime(year, mon, 1)
    if mon == 12:
        end = datetime(year + 1, 1, 1)
    else:
        end = datetime(year, mon + 1, 1)

    # Total loans this month
    total_result = await db.execute(
        select(func.count(Loan.id)).where(
            Loan.created_at >= start,
            Loan.created_at < end,
        )
    )
    total_loans = total_result.scalar() or 0

    # Approved this month
    approved_result = await db.execute(
        select(func.count(Loan.id)).where(
            Loan.created_at >= start,
            Loan.created_at < end,
            Loan.status.in_([
                LoanStatus.APPROVED, LoanStatus.DISBURSED,
                LoanStatus.ACTIVE, LoanStatus.CLOSED, LoanStatus.PRE_CLOSED,
            ]),
        )
    )
    approved = approved_result.scalar() or 0

    # Rejected this month
    rejected_result = await db.execute(
        select(func.count(Loan.id)).where(
            Loan.created_at >= start,
            Loan.created_at < end,
            Loan.status == LoanStatus.REJECTED,
        )
    )
    rejected = rejected_result.scalar() or 0

    processed = approved + rejected
    approval_rate = approved / processed if processed > 0 else 0

    # NPA rate (active loans with 90+ DPD)
    active_result = await db.execute(
        select(func.count(Loan.id)).where(
            Loan.status.in_([LoanStatus.ACTIVE, LoanStatus.DISBURSED])
        )
    )
    total_active = active_result.scalar() or 0

    npa_result = await db.execute(
        select(func.count(CollectionsCase.id)).where(
            CollectionsCase.dpd_bucket == "90+"
        )
    )
    npa_count = npa_result.scalar() or 0
    npa_rate = npa_count / total_active if total_active > 0 else 0

    # Collection efficiency (EMIs paid on time / total due)
    total_due = await db.execute(
        select(func.count(EMISchedule.id)).where(
            EMISchedule.due_date >= start,
            EMISchedule.due_date < end,
        )
    )
    total_due_count = total_due.scalar() or 0

    paid_ontime = await db.execute(
        select(func.count(EMISchedule.id)).where(
            EMISchedule.due_date >= start,
            EMISchedule.due_date < end,
            EMISchedule.status == PaymentStatus.PAID,
        )
    )
    paid_ontime_count = paid_ontime.scalar() or 0
    collection_efficiency = paid_ontime_count / total_due_count if total_due_count > 0 else 0

    return {
        "month": f"{year}-{mon:02d}",
        "total_loans": total_loans,
        "approved": approved,
        "rejected": rejected,
        "approval_rate": round(approval_rate, 4),
        "npa_rate": round(npa_rate, 4),
        "npa_count": npa_count,
        "total_active": total_active,
        "collection_efficiency": round(collection_efficiency, 4),
        "avg_processing_days": 1.8,  # Placeholder for prototype
    }


def generate_benchmark_html(metrics: dict, benchmarks: dict, tenant_name: str = "NexLoan") -> str:
    """Generate HTML email showing client metrics vs industry benchmarks."""
    def color(val, bench, higher_is_better=True):
        if higher_is_better:
            return "#16A34A" if val >= bench else "#DC2626"
        else:
            return "#16A34A" if val <= bench else "#DC2626"

    def pct(val):
        return f"{val * 100:.1f}%"

    ar_color = color(metrics["approval_rate"], benchmarks["approval_rate"])
    npa_color = color(metrics["npa_rate"], benchmarks["npa_rate"], higher_is_better=False)
    ce_color = color(metrics["collection_efficiency"], benchmarks["collection_efficiency"])

    return f"""
    <html>
    <body style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #F9FAFB;">
        <div style="background: #1A1A2E; color: white; padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="margin: 0; font-size: 20px;">{tenant_name} — Monthly Performance Report</h1>
            <p style="margin: 4px 0 0; opacity: 0.8; font-size: 14px;">{metrics['month']}</p>
        </div>

        <div style="background: white; padding: 24px; border: 1px solid #E5E7EB;">
            <h2 style="font-size: 16px; margin-top: 0;">Performance vs Industry Benchmarks</h2>

            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr style="border-bottom: 1px solid #E5E7EB;">
                    <th style="text-align: left; padding: 10px;">Metric</th>
                    <th style="text-align: center; padding: 10px;">Your Platform</th>
                    <th style="text-align: center; padding: 10px;">Industry Avg</th>
                    <th style="text-align: center; padding: 10px;">Status</th>
                </tr>
                <tr style="border-bottom: 1px solid #F3F4F6;">
                    <td style="padding: 10px;">Approval Rate</td>
                    <td style="text-align: center; padding: 10px; color: {ar_color}; font-weight: 600;">{pct(metrics['approval_rate'])}</td>
                    <td style="text-align: center; padding: 10px; color: #6B7280;">{pct(benchmarks['approval_rate'])}</td>
                    <td style="text-align: center; padding: 10px;">{'✅' if metrics['approval_rate'] >= benchmarks['approval_rate'] else '⚠️'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #F3F4F6;">
                    <td style="padding: 10px;">NPA Rate</td>
                    <td style="text-align: center; padding: 10px; color: {npa_color}; font-weight: 600;">{pct(metrics['npa_rate'])}</td>
                    <td style="text-align: center; padding: 10px; color: #6B7280;">{pct(benchmarks['npa_rate'])}</td>
                    <td style="text-align: center; padding: 10px;">{'✅' if metrics['npa_rate'] <= benchmarks['npa_rate'] else '⚠️'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #F3F4F6;">
                    <td style="padding: 10px;">Collection Efficiency</td>
                    <td style="text-align: center; padding: 10px; color: {ce_color}; font-weight: 600;">{pct(metrics['collection_efficiency'])}</td>
                    <td style="text-align: center; padding: 10px; color: #6B7280;">{pct(benchmarks['collection_efficiency'])}</td>
                    <td style="text-align: center; padding: 10px;">{'✅' if metrics['collection_efficiency'] >= benchmarks['collection_efficiency'] else '⚠️'}</td>
                </tr>
            </table>

            <div style="margin-top: 20px; padding: 16px; background: #F9FAFB; border-radius: 8px;">
                <h3 style="margin-top: 0; font-size: 14px;">Summary</h3>
                <p style="font-size: 13px; color: #374151; margin: 0;">
                    Total loans processed: {metrics['total_loans']} |
                    Active portfolio: {metrics['total_active']} loans |
                    NPA cases: {metrics['npa_count']}
                </p>
            </div>
        </div>

        <div style="background: #F3F4F6; padding: 16px; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #9CA3AF;">Powered by Theoremlabs</p>
        </div>
    </body>
    </html>
    """


async def send_monthly_benchmark_report():
    """Monthly job: generate and email benchmark report."""
    logger.info("📊 Generating monthly benchmark report...")

    async with AsyncSessionLocal() as db:
        try:
            from app.models.loan import TenantConfig
            from app.config import settings

            tenant_result = await db.execute(
                select(TenantConfig).where(TenantConfig.tenant_id == settings.TENANT_ID)
            )
            tenant = tenant_result.scalar_one_or_none()

            if not tenant or not tenant.benchmark_report_enabled:
                logger.info("Benchmark reports disabled — skipping")
                return

            metrics = await calculate_monthly_metrics(db)
            html = generate_benchmark_html(metrics, INDUSTRY_BENCHMARKS, tenant.client_name)

            if tenant.benchmark_report_email:
                try:
                    from app.services.email_service import send_generic_email
                    await send_generic_email(
                        to_email=tenant.benchmark_report_email,
                        subject=f"{tenant.client_name} Monthly Performance Report — {metrics['month']}",
                        html_content=html,
                    )
                    logger.info(f"✅ Benchmark report sent to {tenant.benchmark_report_email}")
                except Exception as e:
                    logger.warning(f"Failed to send benchmark email: {e}")
            else:
                logger.info("No benchmark_report_email configured — report generated but not emailed")

        except Exception as e:
            logger.error(f"❌ Benchmark report error: {e}")
