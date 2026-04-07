"""
Web traffic analytics — lightweight first-party tracking.

Public ingest endpoint records page views; admin endpoint returns aggregates
(unique visitors, views, top pages, referrers, device breakdown, timeseries).
"""
from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse
import hashlib
import os
import uuid
import jwt as pyjwt

from database import db, logger, get_current_admin, JWT_SECRET, JWT_ALGORITHM
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(tags=["Analytics"])

ANALYTICS_SALT = os.environ.get("ANALYTICS_SALT", "hireabble-analytics-default-salt-change-me")


class TrackEvent(BaseModel):
    path: str = Field(..., max_length=500)
    referrer: Optional[str] = Field(None, max_length=500)
    visitor_id: str = Field(..., max_length=64)
    session_id: str = Field(..., max_length=64)
    screen_w: Optional[int] = None
    screen_h: Optional[int] = None


def _hash_ip(ip: str) -> str:
    return hashlib.sha256(f"{ANALYTICS_SALT}:{ip}".encode()).hexdigest()[:32]


def _device_from_ua(ua: str) -> str:
    if not ua:
        return "unknown"
    ua_l = ua.lower()
    if "tablet" in ua_l or "ipad" in ua_l:
        return "tablet"
    if "mobi" in ua_l or "iphone" in ua_l or "android" in ua_l:
        return "mobile"
    return "desktop"


def _referrer_source(ref: Optional[str]) -> str:
    if not ref:
        return "direct"
    try:
        host = urlparse(ref).netloc.lower()
        if host.startswith("www."):
            host = host[4:]
        return host or "direct"
    except Exception:
        return "direct"


def _maybe_user_id(request: Request) -> Optional[str]:
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return None
    token = auth.split(" ", 1)[1]
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("user_id") or payload.get("sub")
    except Exception:
        return None


@router.post("/analytics/track")
@limiter.limit("120/minute")
async def track(event: TrackEvent, request: Request):
    # Do not track admin panel paths
    if event.path.startswith("/admin") or event.path.startswith("/impersonate"):
        return {"ok": True, "skipped": True}

    ip = get_remote_address(request)
    ua = request.headers.get("user-agent", "")[:500]
    user_id = _maybe_user_id(request)

    doc = {
        "_id": str(uuid.uuid4()),
        "visitor_id": event.visitor_id,
        "session_id": event.session_id,
        "path": event.path,
        "referrer": event.referrer or "",
        "referrer_source": _referrer_source(event.referrer),
        "user_agent": ua,
        "device": _device_from_ua(ua),
        "ip_hash": _hash_ip(ip),
        "user_id": user_id,
        "is_authenticated": bool(user_id),
        "screen_w": event.screen_w,
        "screen_h": event.screen_h,
        "created_at": datetime.now(timezone.utc),
    }
    try:
        await db.page_views.insert_one(doc)
    except Exception as e:
        logger.warning(f"page_view insert failed: {e}")
    return {"ok": True}


@router.get("/admin/analytics/traffic")
async def traffic(days: int = 7, admin=Depends(get_current_admin)):
    days = max(1, min(days, 90))
    since = datetime.now(timezone.utc) - timedelta(days=days)
    match = {"created_at": {"$gte": since}}

    granularity = "hour" if days <= 1 else "day"

    # Summary totals
    summary_pipeline = [
        {"$match": match},
        {"$group": {
            "_id": None,
            "total_views": {"$sum": 1},
            "unique_visitors": {"$addToSet": "$visitor_id"},
            "unique_sessions": {"$addToSet": "$session_id"},
            "authenticated": {"$sum": {"$cond": ["$is_authenticated", 1, 0]}},
        }},
        {"$project": {
            "_id": 0,
            "total_views": 1,
            "unique_visitors": {"$size": "$unique_visitors"},
            "unique_sessions": {"$size": "$unique_sessions"},
            "authenticated": 1,
        }},
    ]
    summary_res = await db.page_views.aggregate(summary_pipeline).to_list(1)
    summary = summary_res[0] if summary_res else {
        "total_views": 0, "unique_visitors": 0, "unique_sessions": 0, "authenticated": 0,
    }
    summary["anonymous"] = summary["total_views"] - summary["authenticated"]

    # Timeseries
    ts_pipeline = [
        {"$match": match},
        {"$group": {
            "_id": {"$dateTrunc": {"date": "$created_at", "unit": granularity}},
            "views": {"$sum": 1},
            "visitors": {"$addToSet": "$visitor_id"},
        }},
        {"$project": {
            "_id": 0,
            "date": "$_id",
            "views": 1,
            "visitors": {"$size": "$visitors"},
        }},
        {"$sort": {"date": 1}},
    ]
    timeseries = await db.page_views.aggregate(ts_pipeline).to_list(1000)

    # Top pages
    pages_pipeline = [
        {"$match": match},
        {"$group": {
            "_id": "$path",
            "views": {"$sum": 1},
            "visitors": {"$addToSet": "$visitor_id"},
        }},
        {"$project": {"_id": 0, "path": "$_id", "views": 1, "unique": {"$size": "$visitors"}}},
        {"$sort": {"views": -1}},
        {"$limit": 25},
    ]
    top_pages = await db.page_views.aggregate(pages_pipeline).to_list(25)

    # Top referrers
    ref_pipeline = [
        {"$match": match},
        {"$group": {"_id": "$referrer_source", "count": {"$sum": 1}}},
        {"$project": {"_id": 0, "source": "$_id", "count": 1}},
        {"$sort": {"count": -1}},
        {"$limit": 25},
    ]
    top_referrers = await db.page_views.aggregate(ref_pipeline).to_list(25)

    # Device breakdown
    dev_pipeline = [
        {"$match": match},
        {"$group": {"_id": "$device", "count": {"$sum": 1}}},
        {"$project": {"_id": 0, "device": "$_id", "count": 1}},
    ]
    devices = await db.page_views.aggregate(dev_pipeline).to_list(10)

    return {
        "days": days,
        "granularity": granularity,
        "summary": summary,
        "timeseries": timeseries,
        "top_pages": top_pages,
        "top_referrers": top_referrers,
        "devices": devices,
    }
