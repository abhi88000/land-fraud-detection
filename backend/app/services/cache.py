"""
Redis caching service for LandGuard.
Uses Google Cloud Memorystore for Redis in production.
Gracefully degrades if Redis is unavailable.
"""
import json
import logging
from typing import Optional, Any
from app.core.config import settings

logger = logging.getLogger(__name__)

_redis_client = None


def get_redis_client():
    """Lazy-initialize Redis connection."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client

    if not settings.REDIS_ENABLED or not settings.REDIS_HOST:
        logger.info("Redis disabled or REDIS_HOST not set. Caching will use Firestore fallback.")
        return None

    try:
        import redis
        _redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
            retry_on_timeout=True,
        )
        # Test connection
        _redis_client.ping()
        logger.info(f"Redis connected: {settings.REDIS_HOST}:{settings.REDIS_PORT}")
        return _redis_client
    except Exception as e:
        logger.warning(f"Redis connection failed (will use Firestore fallback): {e}")
        _redis_client = None
        return None


# --- Cache Keys ---
def _ocr_cache_key(document_id: str) -> str:
    return f"landguard:ocr:{document_id}"


def _report_cache_key(document_id: str) -> str:
    return f"landguard:report:{document_id}"


def _rate_limit_key(user_id: str, action: str) -> str:
    return f"landguard:rate:{user_id}:{action}"


def _embedding_cache_key(document_id: str) -> str:
    return f"landguard:embedding:{document_id}"


# --- OCR Cache ---
async def get_cached_ocr(document_id: str) -> Optional[dict]:
    """Get cached OCR/extracted data for a document."""
    client = get_redis_client()
    if not client:
        return None
    try:
        data = client.get(_ocr_cache_key(document_id))
        if data:
            logger.debug(f"Redis OCR cache HIT for {document_id}")
            return json.loads(data)
        return None
    except Exception as e:
        logger.warning(f"Redis get_cached_ocr failed: {e}")
        return None


async def set_cached_ocr(document_id: str, extracted_data: dict, ttl_seconds: int = 86400 * 30):
    """Cache OCR extracted data (default 30 days TTL)."""
    client = get_redis_client()
    if not client:
        return
    try:
        client.setex(_ocr_cache_key(document_id), ttl_seconds, json.dumps(extracted_data))
        logger.debug(f"Redis OCR cache SET for {document_id}")
    except Exception as e:
        logger.warning(f"Redis set_cached_ocr failed: {e}")


# --- Report Cache ---
async def get_cached_report(document_id: str) -> Optional[dict]:
    """Get cached analysis report."""
    client = get_redis_client()
    if not client:
        return None
    try:
        data = client.get(_report_cache_key(document_id))
        if data:
            return json.loads(data)
        return None
    except Exception as e:
        logger.warning(f"Redis get_cached_report failed: {e}")
        return None


async def set_cached_report(document_id: str, report: dict, ttl_seconds: int = 86400 * 7):
    """Cache analysis report (default 7 days TTL)."""
    client = get_redis_client()
    if not client:
        return
    try:
        client.setex(_report_cache_key(document_id), ttl_seconds, json.dumps(report))
    except Exception as e:
        logger.warning(f"Redis set_cached_report failed: {e}")


# --- Rate Limiting ---
async def check_rate_limit(user_id: str, action: str = "analyze", max_requests: int = 20, window_seconds: int = 3600) -> bool:
    """
    Check if user is within rate limit.
    Returns True if allowed, False if rate-limited.
    Uses sliding window counter in Redis.
    """
    client = get_redis_client()
    if not client:
        return True  # No rate limiting without Redis

    key = _rate_limit_key(user_id, action)
    try:
        current = client.get(key)
        if current and int(current) >= max_requests:
            return False
        pipe = client.pipeline()
        pipe.incr(key)
        pipe.expire(key, window_seconds)
        pipe.execute()
        return True
    except Exception as e:
        logger.warning(f"Rate limit check failed: {e}")
        return True  # Allow on failure


# --- Embedding Cache ---
async def get_cached_embedding(document_id: str) -> Optional[list]:
    """Get cached document embedding vector."""
    client = get_redis_client()
    if not client:
        return None
    try:
        data = client.get(_embedding_cache_key(document_id))
        if data:
            return json.loads(data)
        return None
    except Exception as e:
        logger.warning(f"Redis get_cached_embedding failed: {e}")
        return None


async def set_cached_embedding(document_id: str, embedding: list, ttl_seconds: int = 86400 * 30):
    """Cache document embedding vector."""
    client = get_redis_client()
    if not client:
        return
    try:
        client.setex(_embedding_cache_key(document_id), ttl_seconds, json.dumps(embedding))
    except Exception as e:
        logger.warning(f"Redis set_cached_embedding failed: {e}")


# --- Cache Invalidation ---
async def invalidate_document_cache(document_id: str):
    """Invalidate all caches for a document."""
    client = get_redis_client()
    if not client:
        return
    try:
        client.delete(
            _ocr_cache_key(document_id),
            _report_cache_key(document_id),
            _embedding_cache_key(document_id),
        )
    except Exception as e:
        logger.warning(f"Cache invalidation failed: {e}")
