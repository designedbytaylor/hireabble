"""
Stats and utility routes for Hireabble API
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone, timedelta
import io
import re
import asyncio

# PDF Generation
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

from database import (
    db, get_current_user
)
from cache import (
    stats_cache, completeness_cache, superlikes_cache,
    cache_key, get_cached, set_cached
)

router = APIRouter(tags=["Stats & Utilities"])

# ==================== BATCHED DASHBOARD (single request instead of 6-8) ====================

DAILY_SUPERLIKE_LIMIT = 3

def _get_seeker_daily_superlike_limit(user: dict) -> int:
    """Return the daily super like limit based on seeker subscription tier."""
    sub = user.get("subscription", {})
    now = datetime.now(timezone.utc).isoformat()
    if sub.get("status") == "active" and sub.get("period_end", "") >= now:
        tier = sub.get("tier_id", "")
        if tier == "seeker_premium":
            return 999
        elif tier == "seeker_plus":
            return 10
    return DAILY_SUPERLIKE_LIMIT

@router.get("/dashboard")
async def get_seeker_dashboard(current_user: dict = Depends(get_current_user)):
    """Batched endpoint: returns everything the seeker dashboard needs in one request.
    Replaces 6+ separate API calls with a single round trip."""

    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Seeker only")

    uid = current_user["id"]
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    now = datetime.now(timezone.utc).isoformat()

    # --- 5 parallel queries instead of 8: derive counts from the applications list ---
    (
        swiped_apps,
        matches_count,
        user_data,
        unread_messages,
        unread_notifications,
        profile_views_count,
    ) = await asyncio.gather(
        db.applications.find(
            {"seeker_id": uid}, {"job_id": 1, "action": 1, "created_at": 1}
        ).to_list(1000),
        db.matches.count_documents({"seeker_id": uid}),
        db.users.find_one({"id": uid}, {"_id": 0, "seeker_purchased_superlikes": 1, "subscription": 1}),
        db.messages.count_documents({"receiver_id": uid, "is_read": False}),
        db.notifications.count_documents({"user_id": uid, "is_read": False}),
        db.profile_views.count_documents({"seeker_id": uid}),
    )

    # Derive all application counts locally (saves 3 DB round trips)
    swiped_job_ids = [s["job_id"] for s in swiped_apps]
    applications_count = sum(1 for s in swiped_apps if s.get("action") in ("like", "superlike"))
    superlikes_count = sum(1 for s in swiped_apps if s.get("action") == "superlike")
    superlikes_today = sum(
        1 for s in swiped_apps
        if s.get("action") == "superlike" and s.get("created_at", "") >= today_start
    )

    # Fetch available jobs (excluding already-swiped)
    job_query = {"id": {"$nin": swiped_job_ids}, "is_active": True}
    seeker_location = current_user.get("location", "")
    if seeker_location:
        job_query["$or"] = [
            {"location_restriction": None},
            {"location_restriction": "any"},
            {"location_restriction": {"$exists": False}},
            {"location": {"$regex": re.escape(seeker_location.split(",")[0].strip()), "$options": "i"}},
        ]

    jobs = await db.jobs.find(job_query, {"_id": 0}).sort("created_at", -1).to_list(100)

    # Batch-fetch recruiter subscriptions
    recruiter_ids = list(set(j.get("recruiter_id") for j in jobs if j.get("recruiter_id")))
    recruiter_subs = {}
    if recruiter_ids:
        recruiters = await db.users.find(
            {"id": {"$in": recruiter_ids}},
            {"_id": 0, "id": 1, "subscription": 1}
        ).to_list(len(recruiter_ids))
        for r in recruiters:
            sub = r.get("subscription", {})
            if sub.get("status") == "active" and sub.get("period_end", "") >= now:
                recruiter_subs[r["id"]] = sub.get("tier_id", "")

    # Score and sort jobs
    from routers.jobs import calculate_job_match_score
    for job in jobs:
        job["match_score"] = calculate_job_match_score(current_user, job)
        job["is_boosted"] = bool(job.get("is_boosted") and job.get("boost_until", "") >= now)
        rec_tier = recruiter_subs.get(job.get("recruiter_id"), "")
        if rec_tier or job.get("is_featured"):
            job["is_premium_listing"] = True
            job["match_score"] = min(100, job["match_score"] + 15)

    boosted = [j for j in jobs if j.get("is_boosted")]
    regular = [j for j in jobs if not j.get("is_boosted")]
    regular.sort(key=lambda j: (1 if j.get("is_premium_listing") else 0, j["match_score"]), reverse=True)
    result_jobs = list(regular)
    boost_positions = [0, 3, 7, 12, 18]
    for i, bj in enumerate(boosted):
        pos = boost_positions[i] if i < len(boost_positions) else len(result_jobs)
        pos = min(pos, len(result_jobs))
        result_jobs.insert(pos, bj)

    # Profile completeness (computed from current_user, no extra DB call)
    fields_to_check = {
        "name": 10, "title": 15, "bio": 10, "skills": 15,
        "experience_years": 10, "location": 10, "photo_url": 15,
        "school": 5, "degree": 5, "current_employer": 5
    }
    completeness_total = 0
    missing = []
    field_labels = {
        "name": "name", "title": "job title", "bio": "bio", "skills": "skills",
        "experience_years": "experience", "location": "location", "photo_url": "photo",
        "school": "education", "degree": "degree", "current_employer": "employer"
    }
    for field, weight in fields_to_check.items():
        value = current_user.get(field)
        if value and (not isinstance(value, list) or len(value) > 0):
            completeness_total += weight
        else:
            missing.append(field_labels.get(field, field))

    # Superlikes remaining (respects subscription tier limits)
    purchased = (user_data or {}).get("seeker_purchased_superlikes", 0)
    daily_limit = _get_seeker_daily_superlike_limit(user_data or {})
    free_remaining = max(0, daily_limit - superlikes_today)

    # Check if user's subscription allows undo (use fresh DB data, not auth cache)
    sub = (user_data or {}).get("subscription") or current_user.get("subscription") or {}
    can_undo = (
        sub.get("status") == "active"
        and sub.get("period_end", "") >= now
        and sub.get("tier_id", "") in ("seeker_plus", "seeker_premium")
    )

    # Check subscription for premium features
    is_plus_or_premium = (
        sub.get("status") == "active"
        and sub.get("period_end", "") >= now
        and sub.get("tier_id", "") in ("seeker_plus", "seeker_premium")
    )
    is_premium = (
        sub.get("status") == "active"
        and sub.get("period_end", "") >= now
        and sub.get("tier_id") == "seeker_premium"
    )

    # Premium feature flags
    premium_features = {
        "can_see_viewers": is_plus_or_premium,
        "advanced_filters": is_plus_or_premium,
        "superlike_notes": is_premium,
        "application_insights": is_premium,
        "incognito_mode": True,  # Free for all seekers
        "top_picks": is_premium,
    }

    return {
        "jobs": result_jobs,
        "swiped_job_ids": swiped_job_ids,
        "can_undo": can_undo,
        "stats": {
            "applications_sent": applications_count,
            "super_likes_used": superlikes_count,
            "matches": matches_count,
            "profile_views": profile_views_count,
        },
        "premium_features": premium_features,
        "incognito_active": bool(current_user.get("incognito_mode")),
        "boost_active_until": current_user.get("profile_boost_until") if current_user.get("profile_boost_until", "") >= now else None,
        "completeness": {
            "percentage": completeness_total,
            "missing_fields": missing,
            "is_complete": completeness_total >= 80,
        },
        "superlikes": {
            "remaining": free_remaining + purchased,
            "free_remaining": free_remaining,
            "purchased_remaining": purchased,
            "used_today": superlikes_today,
            "daily_limit": daily_limit,
        },
        "unread_messages": unread_messages,
        "unread_notifications": unread_notifications,
    }


@router.get("/recruiter/dashboard-data")
async def get_recruiter_dashboard_data(current_user: dict = Depends(get_current_user)):
    """Batched endpoint: returns everything the recruiter dashboard needs in one request."""

    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="Recruiter only")

    uid = current_user["id"]
    now_iso = datetime.now(timezone.utc).isoformat()
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    # --- All count + list queries in parallel ---
    (
        active_jobs, total_jobs, total_applications, pending_applications,
        super_likes, matches_count, interviews_scheduled, interviews_pending,
        responded, weekly_apps, jobs_list,
        recruiter_jobs,
        raw_applications,
        user_sub_data,
        unread_messages, unread_notifications,
    ) = await asyncio.gather(
        db.jobs.count_documents({"recruiter_id": uid, "is_active": True}),
        db.jobs.count_documents({"recruiter_id": uid}),
        db.applications.count_documents({"recruiter_id": uid}),
        db.applications.count_documents({"recruiter_id": uid, "recruiter_action": None}),
        db.applications.count_documents({"recruiter_id": uid, "action": "superlike"}),
        db.matches.count_documents({"recruiter_id": uid}),
        db.interviews.count_documents({"recruiter_id": uid, "status": "accepted"}),
        db.interviews.count_documents({"recruiter_id": uid, "status": "pending"}),
        db.applications.count_documents({"recruiter_id": uid, "recruiter_action": {"$ne": None}}),
        db.applications.count_documents({"recruiter_id": uid, "created_at": {"$gte": week_ago}}),
        db.jobs.find({"recruiter_id": uid}, {"_id": 0, "id": 1, "title": 1}).to_list(50),
        db.jobs.find({"recruiter_id": uid}, {"_id": 0}).sort("created_at", -1).to_list(100),
        db.applications.find(
            {"recruiter_id": uid, "action": {"$in": ["like", "superlike"]}}, {"_id": 0}
        ).sort("created_at", -1).to_list(100),
        db.users.find_one({"id": uid}, {"_id": 0, "subscription": 1}),
        db.messages.count_documents({"receiver_id": uid, "is_read": False}),
        db.notifications.count_documents({"user_id": uid, "is_read": False}),
    )

    # Per-job stats aggregation
    response_rate = round((responded / total_applications * 100) if total_applications > 0 else 0)
    match_rate = round((matches_count / total_applications * 100) if total_applications > 0 else 0)
    top_jobs = []
    if jobs_list:
        job_ids = [job["id"] for job in jobs_list]
        job_title_map = {job["id"]: job["title"] for job in jobs_list}
        app_counts, match_counts = await asyncio.gather(
            db.applications.aggregate([
                {"$match": {"job_id": {"$in": job_ids}}},
                {"$group": {"_id": "$job_id", "count": {"$sum": 1}}}
            ]).to_list(100),
            db.matches.aggregate([
                {"$match": {"job_id": {"$in": job_ids}}},
                {"$group": {"_id": "$job_id", "count": {"$sum": 1}}}
            ]).to_list(100),
        )
        app_map = {doc["_id"]: doc["count"] for doc in app_counts}
        match_map = {doc["_id"]: doc["count"] for doc in match_counts}
        top_jobs = [{
            "job_id": jid, "title": job_title_map[jid],
            "applications": app_map.get(jid, 0), "matches": match_map.get(jid, 0),
        } for jid in job_ids]
        top_jobs.sort(key=lambda j: j["applications"], reverse=True)

    # Mark premium seekers in applications
    seeker_ids = list(set(a.get("seeker_id") for a in raw_applications if a.get("seeker_id")))
    premium_seekers = set()
    if seeker_ids:
        seekers = await db.users.find(
            {"id": {"$in": seeker_ids}}, {"_id": 0, "id": 1, "subscription": 1}
        ).to_list(len(seeker_ids))
        for s in seekers:
            sub = s.get("subscription", {})
            if sub.get("status") == "active" and sub.get("period_end", "") >= now_iso:
                premium_seekers.add(s["id"])
    for app in raw_applications:
        if app.get("seeker_id") in premium_seekers:
            app["is_premium_seeker"] = True
    sl = [a for a in raw_applications if a.get("action") == "superlike"]
    pr = [a for a in raw_applications if a.get("action") != "superlike" and a.get("is_premium_seeker")]
    rg = [a for a in raw_applications if a.get("action") != "superlike" and not a.get("is_premium_seeker")]
    applications = sl + pr + rg

    # Subscription status
    sub = (user_sub_data or {}).get("subscription", {})
    from routers.payments import SUBSCRIPTION_TIERS
    tier_id = sub.get("tier_id")
    tier = SUBSCRIPTION_TIERS.get(tier_id)
    if tier and sub.get("status") == "active":
        period_end = sub.get("period_end", "")
        if period_end and period_end >= now_iso:
            subscription = {
                "subscribed": True, "tier": tier_id, "tier_name": tier["name"],
                "tier_level": tier["tier_level"], "limits": tier["limits"], "period_end": period_end,
            }
        else:
            subscription = {"subscribed": False, "tier": None, "tier_name": "Free", "limits": {}}
    else:
        subscription = {"subscribed": False, "tier": None, "tier_name": "Free", "limits": {}}

    return {
        "stats": {
            "active_jobs": active_jobs, "total_jobs": total_jobs,
            "total_applications": total_applications, "pending_applications": pending_applications,
            "super_likes": super_likes, "matches": matches_count,
            "interviews_scheduled": interviews_scheduled, "interviews_pending": interviews_pending,
            "response_rate": response_rate, "match_rate": match_rate,
            "weekly_applications": weekly_apps, "top_jobs": top_jobs[:10],
        },
        "jobs": recruiter_jobs,
        "applications": applications,
        "subscription": subscription,
        "unread_messages": unread_messages,
        "unread_notifications": unread_notifications,
    }


# ==================== STATS ====================

@router.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    """Get user statistics"""
    uid = current_user["id"]
    key = cache_key("stats", uid)
    cached = get_cached(stats_cache, key)
    if cached:
        return cached

    if current_user["role"] == "seeker":
        applications, superlikes, matches = await asyncio.gather(
            db.applications.count_documents({"seeker_id": uid, "action": {"$in": ["like", "superlike"]}}),
            db.applications.count_documents({"seeker_id": uid, "action": "superlike"}),
            db.matches.count_documents({"seeker_id": uid}),
        )
        result = {
            "applications_sent": applications,
            "super_likes_used": superlikes,
            "matches": matches
        }
    else:
        jobs, applications, matches = await asyncio.gather(
            db.jobs.count_documents({"recruiter_id": uid}),
            db.applications.count_documents({"recruiter_id": uid}),
            db.matches.count_documents({"recruiter_id": uid}),
        )
        result = {
            "jobs_posted": jobs,
            "applications_received": applications,
            "matches": matches
        }

    set_cached(stats_cache, key, result)
    return result

@router.get("/stats/recruiter")
async def get_recruiter_stats(current_user: dict = Depends(get_current_user)):
    """Get detailed recruiter statistics"""
    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can access this")

    uid = current_user["id"]
    key = cache_key("rstats", uid)
    cached = get_cached(stats_cache, key)
    if cached:
        return cached

    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    # Run all count queries in parallel
    (
        active_jobs, total_jobs, total_applications, pending_applications,
        super_likes, matches, interviews_scheduled, interviews_pending,
        responded, weekly_apps, jobs_list,
    ) = await asyncio.gather(
        db.jobs.count_documents({"recruiter_id": uid, "is_active": True}),
        db.jobs.count_documents({"recruiter_id": uid}),
        db.applications.count_documents({"recruiter_id": uid}),
        db.applications.count_documents({"recruiter_id": uid, "recruiter_action": None}),
        db.applications.count_documents({"recruiter_id": uid, "action": "superlike"}),
        db.matches.count_documents({"recruiter_id": uid}),
        db.interviews.count_documents({"recruiter_id": uid, "status": "accepted"}),
        db.interviews.count_documents({"recruiter_id": uid, "status": "pending"}),
        db.applications.count_documents({"recruiter_id": uid, "recruiter_action": {"$ne": None}}),
        db.applications.count_documents({"recruiter_id": uid, "created_at": {"$gte": week_ago}}),
        db.jobs.find({"recruiter_id": uid}, {"_id": 0, "id": 1, "title": 1}).to_list(50),
    )

    response_rate = round((responded / total_applications * 100) if total_applications > 0 else 0)
    match_rate = round((matches / total_applications * 100) if total_applications > 0 else 0)

    # Get per-job stats with aggregation pipelines (2 queries instead of N*2)
    if jobs_list:
        job_ids = [job["id"] for job in jobs_list]
        job_title_map = {job["id"]: job["title"] for job in jobs_list}

        app_counts, match_counts = await asyncio.gather(
            db.applications.aggregate([
                {"$match": {"job_id": {"$in": job_ids}}},
                {"$group": {"_id": "$job_id", "count": {"$sum": 1}}}
            ]).to_list(100),
            db.matches.aggregate([
                {"$match": {"job_id": {"$in": job_ids}}},
                {"$group": {"_id": "$job_id", "count": {"$sum": 1}}}
            ]).to_list(100),
        )

        app_map = {doc["_id"]: doc["count"] for doc in app_counts}
        match_map = {doc["_id"]: doc["count"] for doc in match_counts}

        top_jobs = [{
            "job_id": jid,
            "title": job_title_map[jid],
            "applications": app_map.get(jid, 0),
            "matches": match_map.get(jid, 0),
        } for jid in job_ids]
        top_jobs.sort(key=lambda j: j["applications"], reverse=True)
    else:
        top_jobs = []

    result = {
        "active_jobs": active_jobs,
        "total_jobs": total_jobs,
        "total_applications": total_applications,
        "pending_applications": pending_applications,
        "super_likes": super_likes,
        "matches": matches,
        "interviews_scheduled": interviews_scheduled,
        "interviews_pending": interviews_pending,
        "response_rate": response_rate,
        "match_rate": match_rate,
        "weekly_applications": weekly_apps,
        "top_jobs": top_jobs[:10],
    }
    set_cached(stats_cache, key, result)
    return result


@router.get("/analytics/insights")
async def get_user_insights(current_user: dict = Depends(get_current_user)):
    """Get detailed analytics insights for the current user."""
    user_id = current_user["id"]
    role = current_user.get("role", "seeker")
    now = datetime.now(timezone.utc)

    if role == "seeker":
        # Application stats
        total_apps = await db.applications.count_documents({"seeker_id": user_id})
        liked_apps = await db.applications.count_documents({"seeker_id": user_id, "action": "like"})
        superliked_apps = await db.applications.count_documents({"seeker_id": user_id, "action": "superlike"})
        total_matches = await db.matches.count_documents({"seeker_id": user_id})

        # Match rate
        match_rate = round((total_matches / max(liked_apps + superliked_apps, 1)) * 100, 1)

        # Applications by week (last 4 weeks)
        four_weeks_ago = (now - timedelta(weeks=4)).isoformat()
        recent_apps = await db.applications.find(
            {"seeker_id": user_id, "created_at": {"$gte": four_weeks_ago}},
            {"_id": 0, "created_at": 1, "action": 1}
        ).to_list(500)

        weekly_apps = {}
        for app in recent_apps:
            week = app["created_at"][:10]  # YYYY-MM-DD
            weekly_apps[week] = weekly_apps.get(week, 0) + 1

        # Profile views (last 30 days)
        thirty_days_ago = (now - timedelta(days=30)).isoformat()
        profile_views = await db.profile_views.count_documents({
            "viewed_id": user_id,
            "created_at": {"$gte": thirty_days_ago}
        })

        # Response rate (how many of user's apps got recruiter action)
        responded_apps = await db.applications.count_documents({
            "seeker_id": user_id,
            "recruiter_action": {"$in": ["accept", "reject"]}
        })
        response_rate = round((responded_apps / max(total_apps, 1)) * 100, 1)

        # Top categories applied to
        pipeline = [
            {"$match": {"seeker_id": user_id}},
            {"$lookup": {"from": "jobs", "localField": "job_id", "foreignField": "id", "as": "job"}},
            {"$unwind": {"path": "$job", "preserveNullAndEmptyCount": True}},
            {"$group": {"_id": "$job.category", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 5}
        ]
        category_stats = []
        async for doc in db.applications.aggregate(pipeline):
            if doc["_id"]:
                category_stats.append({"category": doc["_id"], "count": doc["count"]})

        return {
            "total_applications": total_apps,
            "total_matches": total_matches,
            "match_rate": match_rate,
            "response_rate": response_rate,
            "profile_views_30d": profile_views,
            "superlike_count": superliked_apps,
            "activity_by_day": dict(sorted(weekly_apps.items())),
            "top_categories": category_stats,
        }

    else:  # recruiter
        total_jobs = await db.jobs.count_documents({"recruiter_id": user_id})
        active_jobs = await db.jobs.count_documents({"recruiter_id": user_id, "is_active": True})
        total_apps_received = await db.applications.count_documents({"recruiter_id": user_id})
        total_matches = await db.matches.count_documents({"recruiter_id": user_id})

        # Apps per job
        apps_per_job = round(total_apps_received / max(total_jobs, 1), 1)

        # Match rate
        total_swipes = await db.recruiter_swipes.count_documents({"recruiter_id": user_id, "action": "like"})
        match_rate = round((total_matches / max(total_swipes, 1)) * 100, 1)

        # Activity by day (last 4 weeks)
        four_weeks_ago = (now - timedelta(weeks=4)).isoformat()
        recent_apps = await db.applications.find(
            {"recruiter_id": user_id, "created_at": {"$gte": four_weeks_ago}},
            {"_id": 0, "created_at": 1}
        ).to_list(500)

        daily_apps = {}
        for app in recent_apps:
            day = app["created_at"][:10]
            daily_apps[day] = daily_apps.get(day, 0) + 1

        return {
            "total_jobs": total_jobs,
            "active_jobs": active_jobs,
            "total_applications_received": total_apps_received,
            "total_matches": total_matches,
            "apps_per_job": apps_per_job,
            "match_rate": match_rate,
            "activity_by_day": dict(sorted(daily_apps.items())),
        }


@router.get("/profile/completeness")
async def get_profile_completeness(current_user: dict = Depends(get_current_user)):
    """Get profile completeness percentage"""
    if current_user["role"] != "seeker":
        return {"percentage": 100, "missing_fields": [], "is_complete": True}

    key = cache_key("completeness", current_user["id"])
    cached = get_cached(completeness_cache, key)
    if cached:
        return cached

    fields_to_check = {
        "name": 10,
        "title": 15,
        "bio": 10,
        "skills": 15,
        "experience_years": 10,
        "location": 10,
        "photo_url": 15,
        "school": 5,
        "degree": 5,
        "current_employer": 5
    }

    # Friendly display names for missing fields
    field_labels = {
        "name": "name",
        "title": "job title",
        "bio": "bio",
        "skills": "skills",
        "experience_years": "experience",
        "location": "location",
        "photo_url": "photo",
        "school": "education",
        "degree": "degree",
        "current_employer": "employer"
    }

    total = 0
    missing = []

    for field, weight in fields_to_check.items():
        value = current_user.get(field)
        if value and (not isinstance(value, list) or len(value) > 0):
            total += weight
        else:
            missing.append(field_labels.get(field, field))
    
    result = {
        "percentage": total,
        "missing_fields": missing,
        "is_complete": total >= 80
    }
    set_cached(completeness_cache, key, result)
    return result

# ==================== RESUME PDF ====================

@router.get("/users/resume/download")
async def download_resume(current_user: dict = Depends(get_current_user)):
    """Download user profile as a professionally formatted PDF resume"""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Only job seekers can download resumes")

    # Fetch full user data (profile may have work_history, education, references)
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})
    if not user:
        user = current_user

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=letter,
        topMargin=0.5 * inch, bottomMargin=0.5 * inch,
        leftMargin=0.65 * inch, rightMargin=0.65 * inch
    )
    styles = getSampleStyleSheet()

    # Color scheme
    primary = colors.HexColor('#1a1a2e')
    accent = colors.HexColor('#6366f1')
    dark_gray = colors.HexColor('#333333')
    med_gray = colors.HexColor('#666666')
    light_gray = colors.HexColor('#999999')

    # Custom styles
    name_style = ParagraphStyle('Name', parent=styles['Heading1'],
        fontSize=26, textColor=primary, spaceAfter=2, fontName='Helvetica-Bold', alignment=TA_LEFT)
    title_style = ParagraphStyle('Title', parent=styles['Normal'],
        fontSize=14, textColor=accent, spaceAfter=4, fontName='Helvetica')
    contact_style = ParagraphStyle('Contact', parent=styles['Normal'],
        fontSize=9, textColor=med_gray, spaceAfter=2, fontName='Helvetica')
    section_style = ParagraphStyle('Section', parent=styles['Heading2'],
        fontSize=12, textColor=accent, spaceBefore=14, spaceAfter=6,
        fontName='Helvetica-Bold', borderWidth=0, leading=16)
    job_title_style = ParagraphStyle('JobTitle', parent=styles['Normal'],
        fontSize=11, textColor=primary, fontName='Helvetica-Bold', spaceAfter=1)
    company_style = ParagraphStyle('Company', parent=styles['Normal'],
        fontSize=10, textColor=med_gray, fontName='Helvetica', spaceAfter=2)
    body_style = ParagraphStyle('Body', parent=styles['Normal'],
        fontSize=10, textColor=dark_gray, spaceAfter=4, fontName='Helvetica', leading=14)
    bullet_style = ParagraphStyle('Bullet', parent=styles['Normal'],
        fontSize=10, textColor=dark_gray, leftIndent=12, fontName='Helvetica', leading=13, spaceAfter=2)

    elements = []

    # ===== HEADER =====
    elements.append(Paragraph(user.get('name', 'Job Seeker'), name_style))
    if user.get('title'):
        elements.append(Paragraph(user['title'], title_style))

    # Contact line
    contact_parts = []
    if user.get('email'):
        contact_parts.append(user['email'])
    if user.get('location'):
        contact_parts.append(user['location'])
    if user.get('work_preference'):
        pref_labels = {'remote': 'Remote', 'onsite': 'On-site', 'hybrid': 'Hybrid', 'flexible': 'Flexible'}
        contact_parts.append(pref_labels.get(user['work_preference'], user['work_preference']))
    if contact_parts:
        elements.append(Paragraph("  |  ".join(contact_parts), contact_style))

    elements.append(Spacer(1, 4))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e0e0e0'), spaceAfter=8))

    # ===== PROFESSIONAL SUMMARY =====
    if user.get('bio'):
        elements.append(Paragraph("PROFESSIONAL SUMMARY", section_style))
        elements.append(Paragraph(user['bio'], body_style))

    # ===== EXPERIENCE =====
    work_history = user.get('work_history', [])
    has_experience = work_history or user.get('current_employer')

    if has_experience:
        elements.append(Paragraph("EXPERIENCE", section_style))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e0e0e0'), spaceAfter=6))

        if work_history:
            for job in work_history:
                title_text = job.get('title', 'Role')
                elements.append(Paragraph(title_text, job_title_style))
                company_line = job.get('company', '')
                dates = ""
                if job.get('start_date'):
                    dates = job['start_date']
                    if job.get('end_date'):
                        dates += f" - {job['end_date']}"
                    else:
                        dates += " - Present"
                if company_line and dates:
                    company_line += f"  |  {dates}"
                elements.append(Paragraph(company_line, company_style))
                if job.get('description'):
                    for line in job['description'].split('\n'):
                        line = line.strip()
                        if line:
                            elements.append(Paragraph(f"• {line}", bullet_style))
                elements.append(Spacer(1, 6))
        else:
            if user.get('current_employer'):
                elements.append(Paragraph(user.get('title', 'Professional'), job_title_style))
                exp_str = f"{user.get('experience_years', 0)}+ years" if user.get('experience_years') else ""
                elements.append(Paragraph(f"{user['current_employer']}  |  {exp_str}", company_style))

    # ===== EDUCATION =====
    edu_list = user.get('education', [])
    has_edu = edu_list or user.get('school')

    if has_edu:
        elements.append(Paragraph("EDUCATION", section_style))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e0e0e0'), spaceAfter=6))

        if edu_list:
            for edu in edu_list:
                degree_text = edu.get('degree', '')
                if edu.get('field'):
                    degree_text += f" in {edu['field']}" if degree_text else edu['field']
                if degree_text:
                    elements.append(Paragraph(degree_text, job_title_style))
                school_line = edu.get('school', '')
                if edu.get('year'):
                    school_line += f"  |  {edu['year']}"
                if school_line:
                    elements.append(Paragraph(school_line, company_style))
                elements.append(Spacer(1, 4))
        else:
            degree_map = {
                'high_school': 'High School Diploma', 'some_college': 'Some College',
                'associates': "Associate's Degree", 'bachelors': "Bachelor's Degree",
                'masters': "Master's Degree", 'phd': 'PhD / Doctorate',
                'bootcamp': 'Bootcamp / Certification', 'self_taught': 'Self-taught',
            }
            degree_display = degree_map.get(user.get('degree', ''), user.get('degree', ''))
            if degree_display:
                elements.append(Paragraph(degree_display, job_title_style))
            if user.get('school'):
                elements.append(Paragraph(user['school'], company_style))

    # ===== SKILLS =====
    if user.get('skills'):
        elements.append(Paragraph("SKILLS", section_style))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e0e0e0'), spaceAfter=6))
        # Display as skill chips in rows
        skills_text = "  •  ".join(user['skills'])
        elements.append(Paragraph(skills_text, body_style))

    # ===== CERTIFICATIONS =====
    if user.get('certifications'):
        elements.append(Paragraph("CERTIFICATIONS", section_style))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e0e0e0'), spaceAfter=6))
        for cert in user['certifications']:
            if isinstance(cert, str) and cert.strip():
                elements.append(Paragraph(f"• {cert}", bullet_style))

    # ===== REFERENCES =====
    refs = user.get('references', [])
    if refs and not user.get('references_hidden', True):
        elements.append(Paragraph("REFERENCES", section_style))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e0e0e0'), spaceAfter=6))
        for ref in refs:
            ref_name = ref.get('name', '')
            ref_title = ref.get('title', '')
            ref_company = ref.get('company', '')
            ref_contact = ref.get('email') or ref.get('phone', '')
            line = f"<b>{ref_name}</b>"
            if ref_title:
                line += f" - {ref_title}"
            if ref_company:
                line += f" at {ref_company}"
            if ref_contact:
                line += f"  |  {ref_contact}"
            elements.append(Paragraph(line, body_style))
    elif refs:
        elements.append(Spacer(1, 10))
        elements.append(Paragraph("References available upon request", ParagraphStyle(
            'RefNote', parent=styles['Normal'], fontSize=9, textColor=light_gray, alignment=TA_CENTER
        )))

    # Footer
    elements.append(Spacer(1, 20))

    doc.build(elements)
    buffer.seek(0)

    filename = f"{user.get('name', 'resume').replace(' ', '_')}_Resume.pdf"

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/applicant/{seeker_id}/resume/pdf")
async def download_applicant_resume_pdf(seeker_id: str, current_user: dict = Depends(get_current_user)):
    """Download a seeker's resume as PDF (recruiter only, must have an application)"""
    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can download applicant resumes")

    # Verify there's an application from this seeker to this recruiter
    app = await db.applications.find_one({
        "seeker_id": seeker_id,
        "recruiter_id": current_user["id"],
        "action": {"$in": ["like", "superlike"]}
    })
    if not app:
        raise HTTPException(status_code=403, detail="No application from this seeker")

    user = await db.users.find_one({"id": seeker_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Seeker not found")

    # Reuse the same PDF generation logic
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=letter,
        topMargin=0.5 * inch, bottomMargin=0.5 * inch,
        leftMargin=0.65 * inch, rightMargin=0.65 * inch
    )
    styles = getSampleStyleSheet()

    primary = colors.HexColor('#1a1a2e')
    accent = colors.HexColor('#6366f1')
    dark_gray = colors.HexColor('#333333')
    med_gray = colors.HexColor('#666666')
    light_gray = colors.HexColor('#999999')

    name_style = ParagraphStyle('Name', parent=styles['Heading1'],
        fontSize=26, textColor=primary, spaceAfter=2, fontName='Helvetica-Bold', alignment=TA_LEFT)
    title_style = ParagraphStyle('Title', parent=styles['Normal'],
        fontSize=14, textColor=accent, spaceAfter=4, fontName='Helvetica')
    contact_style = ParagraphStyle('Contact', parent=styles['Normal'],
        fontSize=9, textColor=med_gray, spaceAfter=2, fontName='Helvetica')
    section_style = ParagraphStyle('Section', parent=styles['Heading2'],
        fontSize=12, textColor=accent, spaceBefore=14, spaceAfter=6,
        fontName='Helvetica-Bold', borderWidth=0, leading=16)
    job_title_style = ParagraphStyle('JobTitle', parent=styles['Normal'],
        fontSize=11, textColor=primary, fontName='Helvetica-Bold', spaceAfter=1)
    company_style = ParagraphStyle('Company', parent=styles['Normal'],
        fontSize=10, textColor=med_gray, fontName='Helvetica', spaceAfter=2)
    body_style = ParagraphStyle('Body', parent=styles['Normal'],
        fontSize=10, textColor=dark_gray, spaceAfter=4, fontName='Helvetica', leading=14)
    bullet_style = ParagraphStyle('Bullet', parent=styles['Normal'],
        fontSize=10, textColor=dark_gray, leftIndent=12, fontName='Helvetica', leading=13, spaceAfter=2)

    elements = []
    elements.append(Paragraph(user.get('name', 'Job Seeker'), name_style))
    if user.get('title'):
        elements.append(Paragraph(user['title'], title_style))

    # Contact line — hide email/phone/address; only show location and Hireabble contact note
    contact_parts = []
    if user.get('location'):
        contact_parts.append(user['location'])
    contact_parts.append("Contact via Hireabble")
    elements.append(Paragraph("  |  ".join(contact_parts), contact_style))

    elements.append(Spacer(1, 4))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e0e0e0'), spaceAfter=8))

    if user.get('bio'):
        elements.append(Paragraph("PROFESSIONAL SUMMARY", section_style))
        elements.append(Paragraph(user['bio'], body_style))

    work_history = user.get('work_history', [])
    if work_history or user.get('current_employer'):
        elements.append(Paragraph("EXPERIENCE", section_style))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e0e0e0'), spaceAfter=6))
        if work_history:
            for job in work_history:
                elements.append(Paragraph(job.get('title', 'Role'), job_title_style))
                cl = job.get('company', '')
                dates = ""
                if job.get('start_date'):
                    dates = job['start_date']
                    dates += f" - {job.get('end_date', 'Present')}"
                if cl and dates:
                    cl += f"  |  {dates}"
                elements.append(Paragraph(cl, company_style))
                if job.get('description'):
                    for line in job['description'].split('\n'):
                        line = line.strip()
                        if line:
                            elements.append(Paragraph(f"• {line}", bullet_style))
                elements.append(Spacer(1, 6))
        elif user.get('current_employer'):
            elements.append(Paragraph(user.get('title', 'Professional'), job_title_style))
            exp_str = f"{user.get('experience_years', 0)}+ years" if user.get('experience_years') else ""
            elements.append(Paragraph(f"{user['current_employer']}  |  {exp_str}", company_style))

    edu_list = user.get('education', [])
    if edu_list or user.get('school'):
        elements.append(Paragraph("EDUCATION", section_style))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e0e0e0'), spaceAfter=6))
        if edu_list:
            for edu in edu_list:
                dt = edu.get('degree', '')
                if edu.get('field'):
                    dt += f" in {edu['field']}" if dt else edu['field']
                if dt:
                    elements.append(Paragraph(dt, job_title_style))
                sl = edu.get('school', '')
                if edu.get('year'):
                    sl += f"  |  {edu['year']}"
                if sl:
                    elements.append(Paragraph(sl, company_style))
                elements.append(Spacer(1, 4))
        elif user.get('school'):
            if user.get('degree'):
                elements.append(Paragraph(user['degree'], job_title_style))
            elements.append(Paragraph(user['school'], company_style))

    if user.get('skills'):
        elements.append(Paragraph("SKILLS", section_style))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e0e0e0'), spaceAfter=6))
        elements.append(Paragraph("  •  ".join(user['skills']), body_style))

    if user.get('certifications'):
        elements.append(Paragraph("CERTIFICATIONS", section_style))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e0e0e0'), spaceAfter=6))
        for cert in user['certifications']:
            if isinstance(cert, str) and cert.strip():
                elements.append(Paragraph(f"• {cert}", bullet_style))

    # No references section on recruiter-downloaded resumes — contact through Hireabble only
    elements.append(Spacer(1, 20))
    doc.build(elements)
    buffer.seek(0)

    filename = f"{user.get('name', 'resume').replace(' ', '_')}_Resume.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ==================== PUSH NOTIFICATIONS ====================

@router.post("/push/subscribe")
async def subscribe_push(subscription: dict, current_user: dict = Depends(get_current_user)):
    """Subscribe to push notifications"""
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"push_subscription": subscription}}
    )
    return {"message": "Push subscription saved"}

@router.delete("/push/unsubscribe")
async def unsubscribe_push(current_user: dict = Depends(get_current_user)):
    """Unsubscribe from push notifications"""
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"push_subscription": None}}
    )
    return {"message": "Push subscription removed"}
