import asyncio
import uuid
from sqlalchemy import text
from app.utils.database import AsyncSessionLocal

CREATE_PRE_CLOSURE_TABLE = """
CREATE TABLE IF NOT EXISTS pre_closure_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(128) UNIQUE NOT NULL,
    token_expires_at TIMESTAMP NOT NULL,
    outstanding_principal FLOAT NOT NULL,
    pre_closure_charge FLOAT NOT NULL,
    pre_closure_charge_percent FLOAT NOT NULL,
    total_settlement_amount FLOAT NOT NULL,
    months_paid INTEGER NOT NULL DEFAULT 0,
    terms_accepted BOOLEAN DEFAULT FALSE,
    terms_accepted_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);
"""

async def run():
    async with AsyncSessionLocal() as session:
        try:
            await session.execute(text(CREATE_PRE_CLOSURE_TABLE))
            await session.commit()
            print("✅ pre_closure_requests table created successfully")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(run())
