"""
Caching layer for Hireabble API.

Uses Redis when REDIS_URL is set (recommended for production with multiple workers).
Falls back to in-memory TTL caches when Redis is unavailable.
"""
import os
import json
import logging
from cachetools import TTLCache

logger = logging.getLogger(__name__)

# ==================== REDIS CONNECTION ====================

_redis = None

def _get_redis():
    """Lazy-init Redis connection."""
    global _redis
    if _redis is not None:
        return _redis
    redis_url = os.environ.get("REDIS_URL")
    if not redis_url:
        return None
    try:
        import redis as _redis_lib
        _redis = _redis_lib.Redis.from_url(
            redis_url,
            decode_responses=True,
            socket_connect_timeout=3,
            socket_timeout=2,
            retry_on_timeout=True,
        )
        _redis.ping()
        logger.info("Redis connected for shared caching")
        return _redis
    except Exception as e:
        logger.warning(f"Redis unavailable, using in-memory cache: {e}")
        _redis = None
        return None

# ==================== TTL PRESETS (seconds) ====================

TTL_STATS = 120
TTL_COMPLETENESS = 60
TTL_PLAN = 60
TTL_SUPERLIKES = 15
TTL_USER_AUTH = 30  # cache authenticated user lookups
TTL_RECRUITER_JOBS = 300  # 5 min TTL for recruiter's active job listings

# ==================== FALLBACK IN-MEMORY CACHES ====================

stats_cache = TTLCache(maxsize=512, ttl=TTL_STATS)
completeness_cache = TTLCache(maxsize=512, ttl=TTL_COMPLETENESS)
plan_cache = TTLCache(maxsize=512, ttl=TTL_PLAN)
superlikes_cache = TTLCache(maxsize=512, ttl=TTL_SUPERLIKES)
user_auth_cache = TTLCache(maxsize=1024, ttl=TTL_USER_AUTH)
recruiter_jobs_cache = TTLCache(maxsize=256, ttl=TTL_RECRUITER_JOBS)

# Map cache object -> (redis key prefix, ttl)
_CACHE_META = {
    id(stats_cache): ("c:stats", TTL_STATS),
    id(completeness_cache): ("c:comp", TTL_COMPLETENESS),
    id(plan_cache): ("c:plan", TTL_PLAN),
    id(superlikes_cache): ("c:sl", TTL_SUPERLIKES),
    id(user_auth_cache): ("c:auth", TTL_USER_AUTH),
    id(recruiter_jobs_cache): ("c:rjobs", TTL_RECRUITER_JOBS),
}

# ==================== PUBLIC API ====================

def cache_key(prefix: str, user_id: str) -> str:
    """Generate a cache key from prefix and user ID."""
    return f"{prefix}:{user_id}"


def get_cached(cache: TTLCache, key: str):
    """Get a value from cache (Redis first, then in-memory fallback)."""
    r = _get_redis()
    if r is not None:
        prefix, _ = _CACHE_META.get(id(cache), ("c:misc", 30))
        rkey = f"{prefix}:{key}"
        try:
            val = r.get(rkey)
            if val is not None:
                return json.loads(val)
        except Exception:
            pass
    return cache.get(key)


def set_cached(cache: TTLCache, key: str, value):
    """Set a value in cache (both Redis and in-memory)."""
    cache[key] = value
    r = _get_redis()
    if r is not None:
        prefix, ttl = _CACHE_META.get(id(cache), ("c:misc", 30))
        rkey = f"{prefix}:{key}"
        try:
            r.setex(rkey, ttl, json.dumps(value))
        except Exception:
            pass


def invalidate(cache: TTLCache, key: str):
    """Remove a specific key from cache."""
    cache.pop(key, None)
    r = _get_redis()
    if r is not None:
        prefix, _ = _CACHE_META.get(id(cache), ("c:misc", 30))
        try:
            r.delete(f"{prefix}:{key}")
        except Exception:
            pass


def invalidate_user(user_id: str):
    """Invalidate all caches for a user (call after writes)."""
    # Each cache has ONE correct prefix — no cross-product needed
    _CACHE_PREFIXES = [
        (stats_cache, "stats"),
        (stats_cache, "rstats"),
        (completeness_cache, "completeness"),
        (plan_cache, "plan"),
        (superlikes_cache, "superlikes"),
        (user_auth_cache, "auth"),
    ]
    r = _get_redis()
    pipe = None
    if r is not None:
        try:
            pipe = r.pipeline(transaction=False)
        except Exception:
            pipe = None
    for cache, prefix in _CACHE_PREFIXES:
        k = cache_key(prefix, user_id)
        cache.pop(k, None)
        if pipe is not None:
            rprefix, _ = _CACHE_META.get(id(cache), ("c:misc", 30))
            pipe.delete(f"{rprefix}:{k}")
    if pipe is not None:
        try:
            pipe.execute()
        except Exception:
            pass


def invalidate_users_batch(user_ids: list):
    """Invalidate all caches for multiple users in one Redis round-trip."""
    if not user_ids:
        return
    _CACHE_PREFIXES = [
        (stats_cache, "stats"),
        (stats_cache, "rstats"),
        (completeness_cache, "completeness"),
        (plan_cache, "plan"),
        (superlikes_cache, "superlikes"),
        (user_auth_cache, "auth"),
    ]
    r = _get_redis()
    pipe = None
    if r is not None:
        try:
            pipe = r.pipeline(transaction=False)
        except Exception:
            pipe = None
    for uid in user_ids:
        for cache, prefix in _CACHE_PREFIXES:
            k = cache_key(prefix, uid)
            cache.pop(k, None)
            if pipe is not None:
                rprefix, _ = _CACHE_META.get(id(cache), ("c:misc", 30))
                pipe.delete(f"{rprefix}:{k}")
    if pipe is not None:
        try:
            pipe.execute()
        except Exception:
            pass


# ==================== USER AUTH CACHE HELPERS ====================

def get_cached_user(user_id: str):
    """Get a cached user object for auth (avoids DB hit per request)."""
    return get_cached(user_auth_cache, cache_key("auth", user_id))


def set_cached_user(user_id: str, user: dict):
    """Cache a user object for auth."""
    set_cached(user_auth_cache, cache_key("auth", user_id), user)
