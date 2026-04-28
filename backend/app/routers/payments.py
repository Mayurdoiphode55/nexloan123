"""
NexLoan Payments Router — Razorpay UPI Integration
Endpoints: /api/payments — create order, verify, webhook, history
"""
import hashlib
import hmac
import logging
import os
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loan import Loan, User, EMISchedule, Payment, AuditLog, PaymentStatus
from app.utils.database import get_db
from app.utils.auth import get_current_user

logger = logging.getLogger("nexloan.payments")
router = APIRouter()

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")
RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")


class VerifyPaymentRequest(BaseModel):
    order_id: str
    payment_id: str
    signature: str


@router.post("/{loan_id}/create-order/{installment_no}")
async def create_payment_order(
    loan_id: str,
    installment_no: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a Razorpay order for an EMI payment."""
    loan = (await db.execute(
        select(Loan).where(Loan.id == loan_id, Loan.user_id == current_user.id)
    )).scalar_one_or_none()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    emi = (await db.execute(
        select(EMISchedule).where(
            EMISchedule.loan_id == loan_id,
            EMISchedule.installment_no == installment_no,
        )
    )).scalar_one_or_none()
    if not emi:
        raise HTTPException(status_code=404, detail="EMI installment not found")

    if emi.status.value == "PAID":
        raise HTTPException(status_code=400, detail="This installment is already paid")

    amount_paise = int(emi.emi_amount * 100)

    # Try Razorpay if keys are set
    razorpay_order_id = None
    if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
        try:
            import razorpay
            client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
            order = client.order.create({
                "amount": amount_paise,
                "currency": "INR",
                "receipt": f"EMI-{installment_no}-{loan.loan_number}",
                "notes": {"loan_id": str(loan_id), "installment_no": installment_no},
            })
            razorpay_order_id = order["id"]
        except Exception as e:
            logger.warning(f"Razorpay order creation failed: {e}. Falling back to simulation.")

    # Fallback: simulate order_id
    if not razorpay_order_id:
        razorpay_order_id = f"order_SIMULATED_{loan.loan_number}_{installment_no}_{uuid.uuid4().hex[:6]}"

    payment = Payment(
        loan_id=loan.id,
        user_id=current_user.id,
        emi_installment_no=installment_no,
        razorpay_order_id=razorpay_order_id,
        amount=emi.emi_amount,
    )
    db.add(payment)
    await db.commit()

    return {
        "order_id": razorpay_order_id,
        "amount": amount_paise,
        "currency": "INR",
        "key_id": RAZORPAY_KEY_ID or "rzp_test_simulation",
        "loan_number": loan.loan_number,
        "installment_no": installment_no,
    }


@router.post("/verify")
async def verify_payment(
    req: VerifyPaymentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Verify Razorpay payment signature and mark EMI as paid."""
    payment = (await db.execute(
        select(Payment).where(Payment.razorpay_order_id == req.order_id)
    )).scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment order not found")

    # Verify signature
    is_valid = False
    if RAZORPAY_KEY_SECRET and not req.order_id.startswith("order_SIMULATED_"):
        try:
            import razorpay
            client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
            client.utility.verify_payment_signature({
                "razorpay_order_id": req.order_id,
                "razorpay_payment_id": req.payment_id,
                "razorpay_signature": req.signature,
            })
            is_valid = True
        except Exception:
            is_valid = False
    else:
        # Simulation mode — accept any
        is_valid = True

    if not is_valid:
        payment.status = "FAILED"
        await db.commit()
        raise HTTPException(status_code=400, detail="Payment verification failed")

    # Update payment
    payment.status = "CAPTURED"
    payment.razorpay_payment_id = req.payment_id
    payment.razorpay_signature = req.signature
    payment.completed_at = datetime.utcnow()

    # Mark EMI as paid
    emi = (await db.execute(
        select(EMISchedule).where(
            EMISchedule.loan_id == payment.loan_id,
            EMISchedule.installment_no == payment.emi_installment_no,
        )
    )).scalar_one_or_none()
    if emi:
        emi.status = PaymentStatus.PAID
        emi.paid_at = datetime.utcnow()
        emi.paid_amount = payment.amount

    # Audit
    loan = (await db.execute(select(Loan).where(Loan.id == payment.loan_id))).scalar_one_or_none()
    if loan:
        loan.total_paid = (loan.total_paid or 0) + payment.amount
        
        # Check if all EMIs are paid
        pending_emis = (await db.execute(
            select(EMISchedule).where(
                EMISchedule.loan_id == loan.id,
                EMISchedule.status != PaymentStatus.PAID
            )
        )).scalars().all()
        
        old_status = loan.status.value
        
        if not pending_emis:
            loan.status = LoanStatus.CLOSED
            loan.closed_at = datetime.utcnow()
            
        audit = AuditLog(
            loan_id=loan.id,
            action="EMI_PAID_RAZORPAY",
            from_status=old_status,
            to_status=loan.status.value,
            actor=str(current_user.id),
            metadata_={"installment_no": payment.emi_installment_no, "amount": payment.amount, "payment_id": req.payment_id},
        )
        db.add(audit)

    await db.commit()
    return {"status": "success", "message": "EMI payment verified and recorded"}


@router.post("/webhook")
async def razorpay_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle Razorpay webhook events."""
    body = await request.body()

    if RAZORPAY_WEBHOOK_SECRET:
        signature = request.headers.get("x-razorpay-signature", "")
        expected = hmac.new(RAZORPAY_WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

    import json
    event = json.loads(body)
    event_type = event.get("event", "")

    if event_type == "payment.captured":
        order_id = event.get("payload", {}).get("payment", {}).get("entity", {}).get("order_id")
        if order_id:
            payment = (await db.execute(
                select(Payment).where(Payment.razorpay_order_id == order_id)
            )).scalar_one_or_none()
            if payment and payment.status != "CAPTURED":
                payment.status = "CAPTURED"
                payment.completed_at = datetime.utcnow()
                await db.commit()

    return {"status": "ok"}


@router.get("/{loan_id}/history")
async def payment_history(
    loan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get payment history for a loan."""
    loan = (await db.execute(
        select(Loan).where(Loan.id == loan_id, Loan.user_id == current_user.id)
    )).scalar_one_or_none()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    payments = (await db.execute(
        select(Payment).where(Payment.loan_id == loan_id).order_by(Payment.created_at.desc())
    )).scalars().all()

    return [
        {
            "id": str(p.id),
            "installment_no": p.emi_installment_no,
            "amount": p.amount,
            "status": p.status,
            "method": p.method,
            "razorpay_payment_id": p.razorpay_payment_id,
            "created_at": p.created_at.isoformat(),
            "completed_at": p.completed_at.isoformat() if p.completed_at else None,
        }
        for p in payments
    ]
