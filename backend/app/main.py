"""
NexLoan — FastAPI Application Entry Point
Lifespan manages DB + Redis initialization. CORS allows all origins for prototype.
Health check at GET /health.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.utils.database import init_db
from app.utils.redis_client import init_redis, close_redis

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s — %(message)s",
)
logger = logging.getLogger("nexloan")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan — runs once on startup and once on shutdown.
    Initializes database tables and Redis connection.
    """
    logger.info("🚀 Starting NexLoan API...")

    # Startup
    try:
        await init_db()
        logger.info("✅ Database initialized")
    except Exception as e:
        logger.warning(f"⚠️  Database initialization skipped: {e}")

    try:
        await init_redis()
        logger.info("✅ Redis connected")
    except Exception as e:
        logger.warning(f"⚠️  Redis connection skipped: {e}")

    logger.info(f"✅ {settings.APP_NAME} API is ready")

    yield

    # Shutdown
    await close_redis()
    logger.info("👋 NexLoan API shut down")


# ─── Create FastAPI App ─────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.APP_NAME,
    description="AI-First Personal Loan Origination System — Powered by Theoremlabs",
    version="1.0.0",
    lifespan=lifespan,
)

# ─── CORS Middleware — Allow all origins for prototype ───────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.1.4:3000",
        "http://192.168.137.1:3000",
        "http://192.168.1.7:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Global Exception Handler — Log full tracebacks ─────────────────────────────
import traceback
from fastapi.responses import JSONResponse
from starlette.requests import Request

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exception(type(exc), exc, exc.__traceback__)
    logger.error(f"❌ Unhandled exception on {request.method} {request.url}:\n{''.join(tb)}")
    return JSONResponse(status_code=500, content={"detail": str(exc)})


# ─── Health Check ────────────────────────────────────────────────────────────────

@app.get("/", tags=["System"])
async def root():
    """Root endpoint — returns a welcome message and API status."""
    return {
        "message": f"Welcome to {settings.APP_NAME} API",
        "version": "1.0.0",
        "status": "healthy"
    }


@app.get("/health", tags=["System"])
async def health_check():
    """Health check endpoint — returns OK if the API is running."""
    return {"status": "ok", "app": settings.APP_NAME}


@app.get("/debug-otp/{email}", tags=["System"])
async def debug_otp(email: str):
    """Debug endpoint — test send-otp flow."""
    import traceback as tb_mod
    from sqlalchemy import text
    from app.utils.database import AsyncSessionLocal
    try:
        async with AsyncSessionLocal() as db:
            row = (await db.execute(
                text("SELECT id, full_name, email FROM users WHERE email = :e LIMIT 1"),
                {"e": email},
            )).mappings().first()
            if row:
                return {"found": True, "name": row["full_name"], "email": row["email"]}
            return {"found": False}
    except Exception as e:
        return {"error": str(e), "traceback": tb_mod.format_exc()}


# ─── Router Registration ────────────────────────────────────────────────────────

from app.routers import auth

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])

from app.routers import application, underwriting, disbursement, servicing, closure, chatbot, admin, readiness, tracking, user_management, support, referral, officer, co_applicant, payments
app.include_router(application.router, prefix="/api/application", tags=["Application"])
app.include_router(underwriting.router, prefix="/api/underwriting", tags=["Underwriting"])
app.include_router(disbursement.router, prefix="/api/disbursement", tags=["Disbursement"])
app.include_router(servicing.router, prefix="/api/servicing", tags=["Servicing"])
app.include_router(closure.router, prefix="/api/closure", tags=["Closure"])
app.include_router(chatbot.router, prefix="/api/chatbot", tags=["Chatbot"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(readiness.router, prefix="/api/readiness", tags=["Readiness"])
app.include_router(tracking.router, prefix="/api/tracking", tags=["Tracking"])
app.include_router(user_management.router, prefix="/api/users", tags=["User Management"])
app.include_router(support.router, prefix="/api/support", tags=["Support"])
app.include_router(referral.router, prefix="/api/referral", tags=["Referral"])
app.include_router(officer.router, prefix="/api/officer", tags=["Officer"])
app.include_router(co_applicant.router, prefix="/api/application", tags=["Co-Applicant"])
app.include_router(payments.router, prefix="/api/payments", tags=["Payments"])


