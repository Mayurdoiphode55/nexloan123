import asyncio
from sqlalchemy import text
from app.utils.database import AsyncSessionLocal

async def add_column():
    async with AsyncSessionLocal() as session:
        try:
            await session.execute(text("ALTER TABLE loans ADD COLUMN gender VARCHAR(20);"))
            await session.commit()
            print("Successfully added gender column to loans table")
        except Exception as e:
            print(f"Error (column might already exist): {e}")

if __name__ == "__main__":
    asyncio.run(add_column())
