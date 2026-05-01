import asyncio
from sqlalchemy import select
from app.utils.database import AsyncSessionLocal
from app.models.loan import TenantConfig

async def update_tenant():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(TenantConfig))
        tenant = result.scalars().first()
        if tenant:
            tenant.collateral_policy = {"threshold_amount": 1000000}
            tenant.feature_collateral_loans = True
            await db.commit()
            print("Tenant config updated")
        else:
            print("No tenant config found")

if __name__ == "__main__":
    asyncio.run(update_tenant())
