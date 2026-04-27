"""
NexLoan Redis Client — OTP Storage, Chat Session Management
Async Redis client with helpers for OTP verification flow and chatbot session state.
"""

import json
import logging
from typing import Optional, Dict, Any

import redis.asyncio as aioredis

from app.config import settings

logger = logging.getLogger("nexloan.redis")

# Global Redis client — initialized during app lifespan
redis_client: Optional[aioredis.Redis] = None
redis_available: bool = False


async def init_redis():
    """
    Initialize the async Redis connection.
    Called during FastAPI lifespan startup.
    If Redis fails, continue without it (Redis is optional for development).
    """
    global redis_client, redis_available
    try:
        redis_client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
        # Test connection
        await redis_client.ping()
        redis_available = True
        logger.info("✅ Redis connected")
    except Exception as e:
        redis_available = False
        redis_client = None
        logger.warning(f"⚠️  Redis not available (development mode): {e}")


async def close_redis():
    """Close the Redis connection gracefully."""
    global redis_client, redis_available
    if redis_client:
        try:
            await redis_client.close()
        except Exception:
            pass
        redis_client = None
        redis_available = False


def get_redis() -> Optional[aioredis.Redis]:
    """Get the active Redis client. Returns None if not available."""
    return redis_client if redis_available else None


# ─── OTP Helpers ────────────────────────────────────────────────────────────────

# In-memory OTP storage fallback for when Redis is unavailable
_memory_otps: Dict[str, str] = {}


async def store_otp(identifier: str, otp: str) -> None:
    """
    Store an OTP in Redis with TTL from settings.
    Also stores in-memory as a backup, so verify_otp can always find it.
    Key format: otp:{identifier} (identifier is email or mobile)
    """
    key = f"otp:{identifier}"

    # Always store in memory as backup
    _memory_otps[key] = otp

    try:
        client = get_redis()
        if client:
            await client.setex(key, settings.OTP_EXPIRE_SECONDS, otp)
            logger.debug(f"🔐 OTP stored in Redis + memory for {identifier}")
        else:
            logger.debug(f"🔐 OTP stored in memory only for {identifier} (Redis unavailable)")
    except Exception as e:
        logger.warning(f"⚠️  Redis OTP storage failed, stored in memory only: {e}")


async def verify_otp(identifier: str, otp: str) -> bool:
    """
    Verify an OTP against Redis or memory storage.
    Returns True if the OTP matches. Deletes the key on success (one-time use).
    Checks BOTH Redis and in-memory storage to handle cases where the OTP
    was stored in memory due to a transient Redis write failure.
    """
    key = f"otp:{identifier}"
    logger.debug(f"🔍 Verifying OTP for {identifier}, checking key: {key}")

    # 1. Try Redis first
    try:
        client = get_redis()
        if client:
            stored_otp = await client.get(key)
            logger.debug(f"🔍 Redis lookup for {key}: found={'yes' if stored_otp else 'no'}")

            if stored_otp is not None and stored_otp == otp:
                await client.delete(key)
                logger.debug(f"✅ OTP verified via Redis for {identifier}")
                return True
    except Exception as e:
        logger.warning(f"⚠️  Redis OTP lookup error: {e}")

    # 2. Always also check in-memory storage (fallback)
    stored_otp = _memory_otps.get(key)
    logger.debug(f"🔍 Memory lookup for {key}: found={'yes' if stored_otp else 'no'}")
    if stored_otp is not None and stored_otp == otp:
        del _memory_otps[key]
        logger.debug(f"✅ OTP verified from memory for {identifier}")
        return True

    logger.debug(f"❌ OTP verification failed for {identifier} — no match in Redis or memory")
    return False


# ─── Chat Session Helpers ───────────────────────────────────────────────────────

# In-memory chat session storage fallback
_memory_chat_sessions: Dict[str, Dict[str, Any]] = {}


async def store_chat_session(session_id: str, session_data: Dict[str, Any]) -> None:
    """
    Store a chatbot session in Redis or memory.
    Key format: chat:{session_id}
    TTL: 24 hours (86400 seconds)
    """
    try:
        client = get_redis()
        if client:
            key = f"chat:{session_id}"
            await client.setex(key, 86400, json.dumps(session_data))
        else:
            # Fallback: store in memory
            _memory_chat_sessions[f"chat:{session_id}"] = session_data
    except Exception as e:
        # Fallback: store in memory on error
        _memory_chat_sessions[f"chat:{session_id}"] = session_data
        logger.warning(f"⚠️  Chat session storage failed, using memory: {e}")


async def get_chat_session(session_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve a chatbot session from Redis or memory.
    Returns None if the session doesn't exist or has expired.
    """
    try:
        client = get_redis()
        if client:
            key = f"chat:{session_id}"
            data = await client.get(key)
            if data is not None:
                return json.loads(data)
        else:
            # Fallback: get from memory
            key = f"chat:{session_id}"
            return _memory_chat_sessions.get(key)
    except Exception as e:
        # Fallback: get from memory on error
        key = f"chat:{session_id}"
        return _memory_chat_sessions.get(key)
    return None


async def delete_chat_session(session_id: str) -> None:
    """Delete a chatbot session from Redis or memory."""
    try:
        client = get_redis()
        if client:
            key = f"chat:{session_id}"
            await client.delete(key)
        else:
            # Fallback: delete from memory
            key = f"chat:{session_id}"
            if key in _memory_chat_sessions:
                del _memory_chat_sessions[key]
    except Exception as e:
        # Fallback: delete from memory on error
        key = f"chat:{session_id}"
        if key in _memory_chat_sessions:
            del _memory_chat_sessions[key]
