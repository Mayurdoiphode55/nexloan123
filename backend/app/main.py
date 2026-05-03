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

    # Start EMI reminder scheduler
    scheduler = None
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from app.services.reminder_service import send_emi_reminders
        scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")
        scheduler.add_job(send_emi_reminders, 'cron', hour=9, minute=0, id='emi_reminders')

        # Phase 2: Statement automation
        from app.services.statement_service import generate_monthly_statements, generate_annual_statements
        scheduler.add_job(generate_monthly_statements, 'cron', day=1, hour=6, minute=0, id='monthly_statements')
        scheduler.add_job(generate_annual_statements, 'cron', month=4, day=1, hour=6, minute=0, id='annual_statements')

        # Phase 5: Collections engine — daily 6 AM
        from app.services.collections_engine import run_collections_engine
        scheduler.add_job(run_collections_engine, 'cron', hour=6, minute=0, id='collections_engine')

        # Phase 5: Early warning system — weekly Monday 7 AM
        from app.services.early_warning import run_early_warning_system
        scheduler.add_job(run_early_warning_system, 'cron', day_of_week='mon', hour=7, minute=0, id='early_warning')

        # Phase 5: Offer expiry — daily midnight
        async def expire_offers_job():
            from app.utils.database import AsyncSessionLocal
            from app.services.offer_engine import expire_old_offers
            async with AsyncSessionLocal() as db:
                await expire_old_offers(db)
        scheduler.add_job(expire_offers_job, 'cron', hour=0, minute=5, id='offer_expiry')

        # Phase 5: Benchmark report — 1st of every month at 8 AM
        from app.services.benchmark_service import send_monthly_benchmark_report
        scheduler.add_job(send_monthly_benchmark_report, 'cron', day=1, hour=8, minute=0, id='benchmark_report')

        scheduler.start()
        logger.info("✅ EMI reminder scheduler started (daily at 9:00 AM IST)")
        logger.info("✅ Statement automation scheduled (monthly 1st 6AM, annual April 1st 6AM)")
        logger.info("✅ Phase 5 jobs: collections (6AM daily), early-warning (Mon 7AM), offers (midnight), benchmark (1st 8AM)")
    except ImportError:
        logger.warning("⚠️  APScheduler not installed — EMI reminders disabled. Install with: pip install apscheduler")
    except Exception as e:
        logger.warning(f"⚠️  Scheduler failed to start: {e}")

    logger.info(f"✅ {settings.APP_NAME} API is ready")

    yield

    # Shutdown
    if scheduler:
        scheduler.shutdown(wait=False)
        logger.info("🛑 Scheduler shut down")
    await close_redis()
    logger.info("👋 NexLoan API shut down")


# ─── Create FastAPI App ─────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.APP_NAME,
    description="AI-First Personal Loan Origination System — Powered by Theoremlabs",
    version="1.0.0",
    lifespan=lifespan,
    debug=True,
)

# ─── CORS Middleware — Allow all origins for prototype ───────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:8001",
        "http://127.0.0.1:8001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Global Exception Handler — Log full tracebacks ─────────────────────────────
import traceback
from fastapi.responses import JSONResponse
from starlette.requests import Request

# @app.exception_handler(Exception)
# async def global_exception_handler(request: Request, exc: Exception):
#     tb = traceback.format_exception(type(exc), exc, exc.__traceback__)
#     tb_str = ''.join(tb)
#     logger.error(f"❌ Unhandled exception on {request.method} {request.url}:\n{tb_str}")
#     return JSONResponse(status_code=500, content={"detail": str(exc) or "Internal server error", "traceback": tb_str[-800:]})


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

# Phase 5 — Notifications, Documents
from app.routers import notifications, documents
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])

# Phase 2 — Enterprise Features
from app.routers import dashboard, enquiry, delegation, announcements
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(enquiry.router, prefix="/api/enquiry", tags=["Enquiry"])
app.include_router(delegation.router, prefix="/api/delegation", tags=["Delegation"])
app.include_router(announcements.router, prefix="/api/announcements", tags=["Announcements"])

# Employee management alias (also accessible via /api/users/employees but this is cleaner)
app.include_router(user_management.router, prefix="/api/employees", tags=["Employees"], include_in_schema=False)

# Phase 4 (prompt4.md) — White-label config + Statements
from app.routers import config_router, statements
app.include_router(config_router.router, prefix="/api/config", tags=["Config"])
app.include_router(statements.router, prefix="/api/statements", tags=["Statements"])

# Phase 5 (prompt5.md) — Revenue, Risk, Operations & Analytics
from app.routers import offers, topup, collections, portfolio, agent, bulk_upload, embed, analytics, experiments, risk
app.include_router(offers.router, prefix="/api/offers", tags=["Offers"])
app.include_router(topup.router, prefix="/api/topup", tags=["Top-Up"])
app.include_router(collections.router, prefix="/api/collections", tags=["Collections"])
app.include_router(portfolio.router, prefix="/api/portfolio", tags=["Portfolio"])
app.include_router(agent.router, prefix="/api/agent", tags=["Agent"])
app.include_router(bulk_upload.router, prefix="/api/bulk", tags=["Bulk Upload"])
app.include_router(embed.router, prefix="/api/embed", tags=["Embedded Lending"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(experiments.router, prefix="/api/experiments", tags=["Experiments"])
app.include_router(risk.router, prefix="/api/risk", tags=["Risk"])

