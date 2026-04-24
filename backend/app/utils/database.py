"""
NexLoan Database Utilities — Async SQLAlchemy Engine & Session
Provides async engine, session factory, init_db(), and get_db() dependency.
"""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
try:
    from sqlalchemy.ext.asyncio import async_sessionmaker
except ImportError:
    from sqlalchemy.orm import sessionmaker
    # Fallback for SQLAlchemy 1.4
    async_sessionmaker = sessionmaker

from sqlalchemy.pool import NullPool
from app.config import settings
from app.models.loan import Base


# Strip any query params from DATABASE_URL that asyncpg doesn't understand
_db_url = settings.DATABASE_URL.split("?")[0]

engine = create_async_engine(
    _db_url,
    echo=settings.DEBUG,
    poolclass=NullPool,
    connect_args={
        "statement_cache_size": 0,
    }
)

# Session factory — expires_on_commit=False for async compatibility
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def init_db():
    """
    Create all tables from the ORM models.
    Called during FastAPI lifespan startup.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    """
    FastAPI dependency that yields an async database session.
    Automatically closes the session when the request is done.

    Usage:
        @router.get("/example")
        async def example(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
