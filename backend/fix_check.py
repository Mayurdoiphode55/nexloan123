import asyncio
from sqlalchemy import text
from app.utils.database import engine

async def check():
    async with engine.connect() as conn:
        r = await conn.execute(text(
            "SELECT table_schema, column_name, data_type FROM information_schema.columns WHERE table_name='users' ORDER BY table_schema, ordinal_position"
        ))
        for row in r.fetchall():
            print(f"  {row[0]:10s} | {row[1]:35s} | {row[2]}")

asyncio.run(check())
