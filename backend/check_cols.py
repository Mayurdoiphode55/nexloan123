import asyncio
from sqlalchemy import text
from app.utils.database import AsyncSessionLocal

async def check(): 
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='users' AND table_schema='public'"))
        cols = [r[0] for r in res.fetchall()]
        print('Columns in public.users table:', cols)

asyncio.run(check())
