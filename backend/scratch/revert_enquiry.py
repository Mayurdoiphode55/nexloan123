import asyncio
from app.utils.database import AsyncSessionLocal
from app.models.loan import ServiceEnquiry
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        enq = (await db.execute(
            select(ServiceEnquiry).where(ServiceEnquiry.email == "sahild.53004@gmail.com")
        )).scalar_one_or_none()
        
        if enq:
            enq.status = "CLAIMED"
            await db.commit()
            print("Status reverted to CLAIMED. You can now click Convert again.")
        else:
            print("Enquiry not found.")

if __name__ == "__main__":
    asyncio.run(main())
