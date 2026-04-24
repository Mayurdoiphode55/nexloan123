"""Simulate the exact send-otp flow to capture the real error."""
import asyncio
import traceback
from sqlalchemy import select
from app.models.loan import User
from app.utils.database import AsyncSessionLocal
from app.utils.auth import generate_otp
from app.utils.redis_client import store_otp, init_redis

async def simulate_send_otp():
    await init_redis()
    
    async with AsyncSessionLocal() as db:
        try:
            stmt = select(User).where(
                (User.email == "mayurdoiphode55@gmail.com") | (User.mobile == "mayurdoiphode55@gmail.com")
            )
            print("Executing query...")
            result = await db.execute(stmt)
            print("Query executed, getting user...")
            user = result.scalars().first()
            print(f"User: {user}")
            
            if user:
                print(f"Name: {user.full_name}")
                print(f"Email: {user.email}")
                
                otp = generate_otp(length=6)
                await store_otp(user.email, otp)
                print(f"OTP: {otp}")
                print("SUCCESS!")
            else:
                print("User not found")
        except Exception as e:
            print(f"\n{'='*60}")
            print(f"ERROR: {type(e).__name__}: {e}")
            print(f"{'='*60}")
            traceback.print_exc()

asyncio.run(simulate_send_otp())
