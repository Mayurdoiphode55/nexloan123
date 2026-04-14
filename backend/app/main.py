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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


# ─── Router Registration ────────────────────────────────────────────────────────

from app.routers import auth

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])

# Remaining routers will be registered in subsequent phases:
from app.routers import application, underwriting, disbursement, servicing, closure, chatbot, admin
app.include_router(application.router, prefix="/api/application", tags=["Application"])
app.include_router(underwriting.router, prefix="/api/underwriting", tags=["Underwriting"])
app.include_router(disbursement.router, prefix="/api/disbursement", tags=["Disbursement"])
app.include_router(servicing.router, prefix="/api/servicing", tags=["Servicing"])
app.include_router(closure.router, prefix="/api/closure", tags=["Closure"])
app.include_router(chatbot.router, prefix="/api/chatbot", tags=["Chatbot"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
