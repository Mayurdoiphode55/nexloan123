import asyncio, sys
sys.path.insert(0, '.')
from sqlalchemy import text
from app.utils.database import AsyncSessionLocal

async def fix_columns():
    async with AsyncSessionLocal() as db:
        await db.execute(text("ALTER TABLE kyc_documents ALTER COLUMN pan_number TYPE VARCHAR(30)"))
        await db.execute(text("ALTER TABLE kyc_documents ALTER COLUMN aadhaar_number TYPE VARCHAR(50)"))
        await db.commit()
        print("Columns resized successfully!")

asyncio.run(fix_columns())
