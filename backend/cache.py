"""
Simple in-memory TTL cache for hot API endpoints.
Uses cachetools for thread-safe TTL-based caching.
"""
from cachetools import TTLCache
import hashlib
import json

# Cache instances with different TTLs
# Stats cache: 30 seconds (stats don't need to be real-time)
stats_cache = TTLCache(maxsize=256, ttl=30)

# Profile completeness cache: 60 seconds
completeness_cache = TTLCache(maxsize=256, ttl=60)

# Subscription/plan cache: 60 seconds
plan_cache = TTLCache(maxsize=256, ttl=60)

# Super likes remaining cache: 15 seconds
superlikes_cache = TTLCache(maxsize=256, ttl=15)


def cache_key(prefix: str, user_id: str) -> str:
    """Generate a cache key from prefix and user ID."""
    return f"{prefix}:{user_id}"


def get_cached(cache: TTLCache, key: str):
    """Get a value from cache, returns None if not found."""
    return cache.get(key)


def set_cached(cache: TTLCache, key: str, value):
    """Set a value in cache."""
    cache[key] = value


def invalidate(cache: TTLCache, key: str):
    """Remove a specific key from cache."""
    cache.pop(key, None)


def invalidate_user(user_id: str):
    """Invalidate all caches for a user (call after writes)."""
    for cache in (stats_cache, completeness_cache, plan_cache, superlikes_cache):
        for prefix in ("stats", "rstats", "completeness", "plan", "superlikes"):
            cache.pop(cache_key(prefix, user_id), None)
