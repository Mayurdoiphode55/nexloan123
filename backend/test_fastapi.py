import logging
from fastapi import FastAPI, BackgroundTasks, Depends
from starlette.requests import Request
from fastapi.responses import JSONResponse
import traceback
from pydantic import BaseModel
from sqlalchemy import text
from app.utils.database import get_db, AsyncSessionLocal
from app.utils.redis_client import store_otp, init_redis, close_redis

logger = logging.getLogger("testapp")

app = FastAPI()

@app.on_event("startup")
async def startup():
    await init_redis()
    print("Test app started")

@app.on_event("shutdown")
async def shutdown():
    await close_redis()

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exception(type(exc), exc, exc.__traceback__)
    tb_str = ''.join(tb)
    print(f"❌ Unhandled exception:\n{tb_str}")
    return JSONResponse(status_code=500, content={"detail": str(exc), "traceback": tb_str})

class SendOTPRequest(BaseModel):
    identifier: str

@app.post("/test-otp")
async def send_otp_endpoint(
    req: SendOTPRequest, 
    background_tasks: BackgroundTasks, 
    db = Depends(get_db)
):
    print("Handling test-otp for", req.identifier)
    
    # 1. DB check
    row = (await db.execute(
        text("SELECT id, full_name, email, mobile FROM users WHERE email = :email_ident OR mobile = :mobile_ident LIMIT 1"),
        {"email_ident": req.identifier, "mobile_ident": req.identifier},
    )).mappings().first()
    
    if not row:
        return {"message": "User not found"}
        
    print("User found:", row["email"])
    
    # 2. Redis store
    otp = "123456"
    try:
        await store_otp(row["email"], otp)
        print("OTP stored")
    except Exception as e:
        print("Redis store error:", e)
        
    # 3. Return response
    return {"message": "Success", "otp": otp}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)
