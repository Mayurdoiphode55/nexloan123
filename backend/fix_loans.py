import asyncio
from sqlalchemy import select
from app.utils.database import AsyncSessionLocal
from app.models.loan import Loan, LoanStatus, PaymentStatus, EMISchedule
from datetime import datetime

async def fix_closed_loans():
    async with AsyncSessionLocal() as session:
        # Find all ACTIVE loans
        loans = (await session.execute(
            select(Loan).where(Loan.status == LoanStatus.ACTIVE)
        )).scalars().all()
        
        count = 0
        for loan in loans:
            pending_emis = (await session.execute(
                select(EMISchedule).where(
                    EMISchedule.loan_id == loan.id,
                    EMISchedule.status != PaymentStatus.PAID
                )
            )).scalars().all()
            
            if not pending_emis:
                loan.status = LoanStatus.CLOSED
                loan.closed_at = datetime.utcnow()
                count += 1
                
        await session.commit()
        print(f"Fixed {count} loans to CLOSED status")

if __name__ == "__main__":
    asyncio.run(fix_closed_loans())
