"""
NexLoan v2.0 Migration — Add new columns to existing tables.
Uses raw asyncpg to avoid pgbouncer prepared-statement conflicts.
Run: python migrate_v2.py
"""
import asyncio
import logging
from app.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("nexloan.migrate")

# Parse the async URL to get a raw asyncpg DSN
DSN = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

MIGRATIONS = [
    "ALTER TABLE loans ADD COLUMN IF NOT EXISTS counter_offer_amount DOUBLE PRECISION",
    "ALTER TABLE loans ADD COLUMN IF NOT EXISTS counter_offer_rate DOUBLE PRECISION",
    "ALTER TABLE loans ADD COLUMN IF NOT EXISTS counter_accepted BOOLEAN",
    "ALTER TABLE loans ADD COLUMN IF NOT EXISTS improvement_plan TEXT",
    "ALTER TABLE loans ADD COLUMN IF NOT EXISTS readiness_score INTEGER",
    "ALTER TABLE loans ADD COLUMN IF NOT EXISTS emi_pauses_used INTEGER DEFAULT 0",
    "ALTER TABLE loans ADD COLUMN IF NOT EXISTS closure_celebration_sent BOOLEAN DEFAULT FALSE",
    "ALTER TABLE loans ADD COLUMN IF NOT EXISTS reapply_reminder_date TIMESTAMP",
    "ALTER TABLE emi_schedule ADD COLUMN IF NOT EXISTS pause_reason TEXT",
    "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'COUNTER_OFFERED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'loanstatus')) THEN ALTER TYPE loanstatus ADD VALUE 'COUNTER_OFFERED'; END IF; END $$",
    "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PAUSED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'paymentstatus')) THEN ALTER TYPE paymentstatus ADD VALUE 'PAUSED'; END IF; END $$",
    """
    CREATE TABLE IF NOT EXISTS loan_readiness_checks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        monthly_income DOUBLE PRECISION,
        employment_type VARCHAR(50),
        existing_emi DOUBLE PRECISION DEFAULT 0,
        loan_amount DOUBLE PRECISION,
        tenure_months INTEGER,
        readiness_score INTEGER,
        result JSONB,
        created_at TIMESTAMP DEFAULT NOW()
    )
    """,
]


async def run():
    import asyncpg
    conn = await asyncpg.connect(DSN, statement_cache_size=0)
    try:
        for i, sql in enumerate(MIGRATIONS, 1):
            try:
                await conn.execute(sql)
                logger.info(f"✅ Migration {i}/{len(MIGRATIONS)} applied")
            except Exception as e:
                logger.warning(f"⚠️  Migration {i}: {e}")
    finally:
        await conn.close()
    logger.info("🏁 All v2.0 migrations complete!")


if __name__ == "__main__":
    asyncio.run(run())
