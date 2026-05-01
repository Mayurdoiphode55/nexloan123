import asyncio
from sqlalchemy import text
from app.utils.database import AsyncSessionLocal

async def add_columns():
    async with AsyncSessionLocal() as db:
        try:
            await db.execute(text("ALTER TABLE loans ADD COLUMN IF NOT EXISTS collateral_verified BOOLEAN DEFAULT FALSE"))
            await db.execute(text("ALTER TABLE loans ADD COLUMN IF NOT EXISTS collateral_verified_by UUID"))
            await db.commit()
            print("✅ Columns added successfully")
        except Exception as e:
            print(f"Error: {e}")
            await db.rollback()

if __name__ == "__main__":
    asyncio.run(add_columns())
