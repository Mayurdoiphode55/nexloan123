import asyncio
from sqlalchemy import text
from app.utils.database import AsyncSessionLocal

statements = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_location VARCHAR(255)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS reporting_manager_id UUID REFERENCES users(id)",
    "ALTER TABLE loans ADD COLUMN IF NOT EXISTS loan_type VARCHAR(30) DEFAULT 'NON_COLLATERAL'",
    "ALTER TABLE loans ADD COLUMN IF NOT EXISTS collateral_type VARCHAR(50)",
    "ALTER TABLE loans ADD COLUMN IF NOT EXISTS collateral_value FLOAT",
    "ALTER TABLE loans ADD COLUMN IF NOT EXISTS collateral_description TEXT",
    "ALTER TABLE loans ADD COLUMN IF NOT EXISTS lien_document_url VARCHAR(500)"
]

async def fix(): 
    for stmt in statements:
        try:
            async with AsyncSessionLocal() as db:
                await db.execute(text(stmt))
                await db.commit()
                print(f"Success: {stmt}")
        except Exception as e:
            print(f"Error on {stmt}: {e}")

    try:
        async with AsyncSessionLocal() as db:
            await db.execute(text('ALTER TABLE admin_delegations RENAME COLUMN permissions TO delegated_permissions'))
            await db.commit()
            print("Success: RENAME permissions")
    except Exception as e:
        print(f"Rename failed: {e}")

asyncio.run(fix())
