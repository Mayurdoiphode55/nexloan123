import asyncio
from sqlalchemy import text
from app.utils.database import engine

COLUMNS = [
    "ALTER TABLE loans ADD COLUMN IF NOT EXISTS officer_override_reason TEXT",
    "ALTER TABLE loans ADD COLUMN IF NOT EXISTS ai_recommendation VARCHAR(20)",
    "ALTER TABLE loans ADD COLUMN IF NOT EXISTS officer_decision VARCHAR(20)",
    "ALTER TABLE loans ADD COLUMN IF NOT EXISTS has_co_applicant BOOLEAN DEFAULT FALSE",
    "ALTER TABLE loans ADD COLUMN IF NOT EXISTS combined_income FLOAT",
    "ALTER TABLE loans ADD COLUMN IF NOT EXISTS combined_existing_emi FLOAT",
    "ALTER TABLE loans ADD COLUMN IF NOT EXISTS combined_credit_score INTEGER",
    "ALTER TABLE loans ADD COLUMN IF NOT EXISTS individual_qualified BOOLEAN",
    "ALTER TABLE loans ADD COLUMN IF NOT EXISTS combined_qualified BOOLEAN",
]

async def main():
    async with engine.begin() as conn:
        for sql in COLUMNS:
            await conn.execute(text(sql))
            print("OK:", sql.split("EXISTS ")[1])
    print("All columns added!")

asyncio.run(main())
