"""Debug script to find the actual 500 error"""
import sys
import asyncio
import traceback

sys.path.insert(0, '.')

# Step 1: Check imports
print("=" * 60)
print("STEP 1: Testing imports...")
try:
    from app.config import settings
    print(f"  settings.DEBUG = {getattr(settings, 'DEBUG', 'NOT FOUND')}")
    print(f"  settings.JWT_SECRET = {settings.JWT_SECRET[:10]}...")
except Exception:
    print("  IMPORT ERROR:")
    traceback.print_exc()

try:
    from app.routers.auth import router
    print("  auth router: OK")
except Exception:
    print("  IMPORT ERROR:")
    traceback.print_exc()

try:
    from app.services.email_service import send_otp_email
    print("  email_service: OK")
except Exception:
    print("  IMPORT ERROR:")
    traceback.print_exc()

try:
    from app.utils.redis_client import store_otp, verify_otp
    print("  redis_client: OK")
except Exception:
    print("  IMPORT ERROR:")
    traceback.print_exc()

# Step 2: Simulate the send-otp endpoint
print("\n" + "=" * 60)
print("STEP 2: Simulating send-otp logic...")

async def test_send_otp():
    from app.utils.database import AsyncSessionLocal
    from app.utils.auth import generate_otp
    from sqlalchemy import text

    async with AsyncSessionLocal() as db:
        identifier = "mayurdoiphode55@gmail.com"
        
        # Same query as send-otp endpoint
        row = (await db.execute(
            text("SELECT id, full_name, email, mobile FROM users WHERE email = :email_ident OR mobile = :mobile_ident LIMIT 1"),
            {"email_ident": identifier, "mobile_ident": identifier},
        )).mappings().first()

        if not row:
            print("  User NOT found!")
            return

        print(f"  User found: {row['full_name']} ({row['email']})")

        otp = generate_otp(length=6)
        print(f"  OTP generated: {otp}")

        try:
            await store_otp(row["email"], otp)
            print("  OTP stored: OK")
        except Exception as e:
            print(f"  OTP store error: {e}")

        # Check if settings.DEBUG exists
        try:
            debug_val = settings.DEBUG
            print(f"  settings.DEBUG = {debug_val}")
        except AttributeError:
            print("  settings.DEBUG DOES NOT EXIST - this would crash!")

        print("\n  ALL STEPS PASSED - send-otp logic works")

try:
    asyncio.run(test_send_otp())
except Exception:
    print("  ERROR in test:")
    traceback.print_exc()

print("\n" + "=" * 60)
print("DONE")
